from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from tenant_control.management.commands.seed_feature_catalog import PACKAGE_MATRIX
from tenant_control.models import Package, Tenant, TenantDomain, TenantStatus, TenantSubscription
from tenant_control.services.provisioning import (
    ProvisionTenantParams,
    deprovision_tenant,
    generate_secret,
    provision_tenant,
)


class IsControlPlaneAdmin(BasePermission):
    message = "Only superusers can manage tenants."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)


def _tenant_payload(tenant: Tenant) -> dict:
    active_subscription = (
        tenant.subscriptions.filter(status="active")
        .select_related("package")
        .order_by("-starts_at")
        .first()
    )
    return {
        "id": tenant.id,
        "slug": tenant.slug,
        "name": tenant.name,
        "status": tenant.status,
        "db_name": tenant.db_name,
        "db_user": tenant.db_user,
        "db_host": tenant.db_host,
        "db_port": tenant.db_port,
        "domains": list(tenant.domains.values("id", "domain", "is_primary", "verified_at")),
        "active_package": active_subscription.package.code if active_subscription else None,
        "updated_at": tenant.updated_at,
        "created_at": tenant.created_at,
    }


def _assign_package(tenant: Tenant, package_code: str) -> None:
    package = Package.objects.filter(code=package_code, is_active=True).first()
    if package is None:
        raise ValueError(f"Package '{package_code}' does not exist or is inactive.")

    existing = TenantSubscription.objects.filter(
        tenant=tenant,
        package=package,
        status="active",
    ).first()
    if existing is None:
        TenantSubscription.objects.create(
            tenant=tenant,
            package=package,
            status="active",
            starts_at=timezone.now(),
        )


class ControlPlanePackageListView(APIView):
    permission_classes = [IsControlPlaneAdmin]

    def get(self, request):
        packages = list(
            Package.objects.values("code", "name", "description", "is_active").order_by("code")
        )
        if not packages:
            # Fallback to static defaults if DB has not been seeded yet.
            packages = [
                {
                    "code": code,
                    "name": code.capitalize(),
                    "description": f"{code.capitalize()} package",
                    "is_active": True,
                }
                for code in PACKAGE_MATRIX.keys()
            ]
        return Response({"results": packages})


class ControlPlaneTenantListCreateView(APIView):
    permission_classes = [IsControlPlaneAdmin]

    def get(self, request):
        tenants = (
            Tenant.objects.all()
            .prefetch_related("domains", "subscriptions__package")
            .order_by("slug")
        )
        return Response({"results": [_tenant_payload(t) for t in tenants]})

    def post(self, request):
        data = request.data

        required = ["slug", "admin_username", "admin_email"]
        missing = [field for field in required if not str(data.get(field, "")).strip()]
        if missing:
            return Response(
                {"detail": "Missing required fields.", "missing": missing},
                status=status.HTTP_400_BAD_REQUEST,
            )

        slug = str(data.get("slug", "")).strip().lower()
        admin_password = str(data.get("admin_password", "")).strip() or generate_secret(20)
        password_generated = not bool(str(data.get("admin_password", "")).strip())

        lock_key = f"tenant_control:provision:{slug}"
        if not cache.add(lock_key, "1", timeout=getattr(settings, "PROVISION_TENANT_RATE_LIMIT_SECONDS", 30)):
            return Response(
                {"detail": "Provisioning is rate-limited for this tenant. Retry shortly."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        params = ProvisionTenantParams(
            slug=slug,
            name=str(data.get("name") or slug).strip(),
            domain=str(data.get("domain", "")).strip() or None,
            admin_username=str(data.get("admin_username", "")).strip(),
            admin_email=str(data.get("admin_email", "")).strip().lower(),
            admin_password=admin_password,
            package_code=str(data.get("package_code", "")).strip() or None,
            db_name=str(data.get("db_name", "")).strip() or None,
            db_user=str(data.get("db_user", "")).strip() or None,
            db_password=str(data.get("db_password", "")).strip() or None,
            db_host=str(data.get("db_host", "")).strip() or None,
            db_port=int(data["db_port"]) if data.get("db_port") else None,
            create_db=not bool(data.get("skip_db_create", False)),
            run_migrations=not bool(data.get("skip_migrate", False)),
        )

        try:
            result = provision_tenant(params)
            tenant = Tenant.objects.get(slug=slug)
        except Exception as exc:  # pragma: no cover - surfaced to API caller
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = {
            "result": result,
            "tenant": _tenant_payload(tenant),
        }
        if password_generated:
            payload["generated_admin_password"] = admin_password
        return Response(payload, status=status.HTTP_201_CREATED)


class ControlPlaneTenantDetailView(APIView):
    permission_classes = [IsControlPlaneAdmin]

    def patch(self, request, slug: str):
        tenant = Tenant.objects.filter(slug=slug).first()
        if tenant is None:
            return Response({"detail": "Tenant not found."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        updates = []

        name = data.get("name")
        if name is not None:
            tenant.name = str(name).strip() or tenant.name
            updates.append("name")

        desired_status = data.get("status")
        if desired_status is not None:
            desired_status = str(desired_status).strip().lower()
            allowed_statuses = {TenantStatus.ACTIVE, TenantStatus.SUSPENDED}
            if desired_status not in allowed_statuses:
                return Response(
                    {"detail": "status must be one of: active, suspended"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            tenant.status = desired_status
            updates.append("status")

        domain = data.get("domain")
        if domain is not None:
            domain = str(domain).strip().lower()
            if domain:
                mapped = TenantDomain.objects.filter(domain=domain).first()
                if mapped and mapped.tenant_id != tenant.id:
                    return Response(
                        {"detail": f"Domain '{domain}' is already mapped to tenant '{mapped.tenant.slug}'."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                TenantDomain.objects.get_or_create(
                    domain=domain,
                    defaults={"tenant": tenant, "is_primary": True},
                )

        package_code = data.get("package_code")
        if package_code is not None and str(package_code).strip():
            try:
                _assign_package(tenant, str(package_code).strip())
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if updates:
            updates.append("updated_at")
            tenant.save(update_fields=updates)

        return Response({"tenant": _tenant_payload(tenant)})


class ControlPlaneTenantDeprovisionView(APIView):
    permission_classes = [IsControlPlaneAdmin]

    def post(self, request, slug: str):
        delete = bool(request.data.get("delete", False))
        drop_db = bool(request.data.get("drop_db", False))

        lock_key = f"tenant_control:deprovision:{slug}"
        if not cache.add(lock_key, "1", timeout=getattr(settings, "DEPROVISION_TENANT_RATE_LIMIT_SECONDS", 30)):
            return Response(
                {"detail": "Deprovisioning is rate-limited for this tenant. Retry shortly."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            result = deprovision_tenant(slug, suspend_only=not delete, drop_db=drop_db)
        except Exception as exc:  # pragma: no cover - surfaced to API caller
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        tenant = Tenant.objects.filter(slug=slug).first()
        return Response({
            "result": result,
            "tenant": _tenant_payload(tenant) if tenant else None,
        })


class ControlPlaneTenantDomainDeleteView(APIView):
    permission_classes = [IsControlPlaneAdmin]

    @transaction.atomic
    def delete(self, request, slug: str, domain_id: int):
        tenant = Tenant.objects.filter(slug=slug).first()
        if tenant is None:
            return Response({"detail": "Tenant not found."}, status=status.HTTP_404_NOT_FOUND)

        domain = TenantDomain.objects.filter(id=domain_id, tenant=tenant).first()
        if domain is None:
            return Response({"detail": "Domain not found for tenant."}, status=status.HTTP_404_NOT_FOUND)

        if tenant.domains.count() <= 1:
            return Response(
                {"detail": "At least one domain must remain mapped to a tenant."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        domain.delete()
        return Response({"tenant": _tenant_payload(tenant)})
