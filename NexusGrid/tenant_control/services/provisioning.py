import secrets
import string
from dataclasses import dataclass

import psycopg2
from psycopg2 import sql

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import transaction
from django.utils import timezone

from NexusGrid.tenant.db_registry import register_tenant_database
from rbac.models import UserRole
from rbac.services import ROLE_ADMIN, ensure_role_in_database

from tenant_control.models import (
    Package,
    ProvisioningJob,
    ProvisioningState,
    Tenant,
    TenantDomain,
    TenantStatus,
    TenantSubscription,
)
from tenant_control.services.audit import record_audit_event


TENANT_MIGRATION_APPS = (
    "contenttypes",
    "auth",
    "sessions",
    "login_manager",
    "rbac",
    "api_v1",
    "system_layout",
    "monitoring",
    "faults",
    "resources",
)


@dataclass
class ProvisionTenantParams:
    slug: str
    name: str
    admin_username: str
    admin_email: str
    admin_password: str
    package_code: str | None = None
    domain: str | None = None
    db_name: str | None = None
    db_user: str | None = None
    db_password: str | None = None
    db_host: str | None = None
    db_port: int | None = None
    create_db: bool = True
    run_migrations: bool = True


def generate_secret(length: int = 24) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _db_name_for_slug(slug: str) -> str:
    prefix = getattr(settings, "TENANT_DB_NAME_PREFIX", "nexusgrid_tenant_")
    safe_slug = "".join(c if c.isalnum() or c == "_" else "_" for c in slug.lower())
    return f"{prefix}{safe_slug}"


def _db_user_for_slug(slug: str) -> str:
    prefix = getattr(settings, "TENANT_DB_USER_PREFIX", "ng_tenant_")
    safe_slug = "".join(c if c.isalnum() or c == "_" else "_" for c in slug.lower())
    return f"{prefix}{safe_slug}"


def _admin_db_connect():
    return psycopg2.connect(
        dbname=getattr(settings, "TENANT_DB_ADMIN_NAME", "postgres"),
        user=getattr(settings, "TENANT_DB_ADMIN_USER", "postgres"),
        password=getattr(settings, "TENANT_DB_ADMIN_PASSWORD", ""),
        host=getattr(settings, "TENANT_DB_ADMIN_HOST", "127.0.0.1"),
        port=getattr(settings, "TENANT_DB_ADMIN_PORT", 5432),
    )


def _role_exists(cur, role_name: str) -> bool:
    cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", [role_name])
    return cur.fetchone() is not None


def _database_exists(cur, db_name: str) -> bool:
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", [db_name])
    return cur.fetchone() is not None


def ensure_database_and_role(db_name: str, db_user: str, db_password: str):
    conn = _admin_db_connect()
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            if not _role_exists(cur, db_user):
                cur.execute(
                    sql.SQL("CREATE ROLE {} LOGIN PASSWORD %s").format(sql.Identifier(db_user)),
                    [db_password],
                )
            else:
                cur.execute(
                    sql.SQL("ALTER ROLE {} WITH PASSWORD %s").format(sql.Identifier(db_user)),
                    [db_password],
                )

            if not _database_exists(cur, db_name):
                cur.execute(
                    sql.SQL("CREATE DATABASE {} OWNER {}").format(
                        sql.Identifier(db_name),
                        sql.Identifier(db_user),
                    )
                )

            cur.execute(
                sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {} TO {}").format(
                    sql.Identifier(db_name),
                    sql.Identifier(db_user),
                )
            )
    finally:
        conn.close()


def drop_database_and_role(db_name: str, db_user: str):
    conn = _admin_db_connect()
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            if _database_exists(cur, db_name):
                cur.execute(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s AND pid <> pg_backend_pid()",
                    [db_name],
                )
                cur.execute(sql.SQL("DROP DATABASE {}") .format(sql.Identifier(db_name)))

            if _role_exists(cur, db_user):
                cur.execute(sql.SQL("DROP ROLE {}") .format(sql.Identifier(db_user)))
    finally:
        conn.close()


def _run_tenant_migrations(alias: str):
    for app_label in TENANT_MIGRATION_APPS:
        call_command("migrate", app_label, database=alias, interactive=False, verbosity=0)


def _ensure_tenant_superuser(alias: str, username: str, email: str, password: str):
    User = get_user_model()
    user_qs = User.objects.db_manager(alias)
    user = user_qs.filter(username=username).first()
    if user:
        user.email = email
        if not user.is_superuser:
            user.is_superuser = True
        if not user.is_staff:
            user.is_staff = True
        user.set_password(password)
        user.save(using=alias)
        return user, False

    user = user_qs.create_superuser(username=username, email=email, password=password)
    return user, True


def _set_subscription(tenant: Tenant, package_code: str | None):
    if not package_code:
        return None

    package = Package.objects.filter(code=package_code, is_active=True).first()
    if package is None:
        raise ValueError(f"Package '{package_code}' does not exist or is inactive.")

    subscription = TenantSubscription.objects.filter(
        tenant=tenant,
        package=package,
        status="active",
    ).first()
    if subscription:
        return subscription

    return TenantSubscription.objects.create(
        tenant=tenant,
        package=package,
        status="active",
        starts_at=timezone.now(),
    )


def _bootstrap_rbac_for_superuser(alias: str, user_id: int):
    role, _ = ensure_role_in_database(ROLE_ADMIN, db_alias=alias, is_system=True)
    UserRole.objects.db_manager(alias).get_or_create(
        user_id=user_id,
        role_id=role.id,
        defaults={"assigned_by_id": user_id},
    )


def provision_tenant(params: ProvisionTenantParams) -> dict:
    result = {
        "tenant_created": False,
        "job_id": None,
        "database_created": False,
        "migrations_ran": False,
        "superuser_created": False,
        "tenant_slug": params.slug,
    }

    with transaction.atomic(using="default"):
        tenant, tenant_created = Tenant.objects.select_for_update().get_or_create(
            slug=params.slug,
            defaults={
                "name": params.name,
                "status": TenantStatus.PROVISIONING,
                "db_name": params.db_name or _db_name_for_slug(params.slug),
                "db_host": params.db_host or getattr(settings, "TENANT_DEFAULT_DB_HOST", "127.0.0.1"),
                "db_port": params.db_port or getattr(settings, "TENANT_DEFAULT_DB_PORT", 5432),
                "db_user": params.db_user or _db_user_for_slug(params.slug),
                "db_password_ciphertext": params.db_password or generate_secret(),
            },
        )

        # Keep metadata up to date when re-running for idempotency.
        tenant.name = params.name
        tenant.db_host = params.db_host or tenant.db_host
        tenant.db_port = params.db_port or tenant.db_port
        tenant.db_name = params.db_name or tenant.db_name
        tenant.db_user = params.db_user or tenant.db_user
        tenant.db_password_ciphertext = params.db_password or tenant.db_password_ciphertext
        tenant.status = TenantStatus.PROVISIONING
        tenant.save(update_fields=[
            "name",
            "db_host",
            "db_port",
            "db_name",
            "db_user",
            "db_password_ciphertext",
            "status",
            "updated_at",
        ])

        job = ProvisioningJob.objects.create(
            tenant=tenant,
            state=ProvisioningState.RUNNING,
            step="initializing",
            started_at=timezone.now(),
        )

    record_audit_event(
        category="provisioning",
        action="tenant.provisioning_started",
        source="command",
        tenant=tenant,
        object_type="ProvisioningJob",
        object_id=str(job.id),
        payload={"tenant_slug": tenant.slug, "tenant_created": tenant_created},
    )

    result["tenant_created"] = tenant_created
    result["job_id"] = job.id

    try:
        if params.domain:
            domain_obj, created = TenantDomain.objects.get_or_create(
                domain=params.domain,
                defaults={"tenant": tenant, "is_primary": True},
            )
            if not created and domain_obj.tenant_id != tenant.id:
                raise ValueError(
                    f"Domain '{params.domain}' is already mapped to tenant '{domain_obj.tenant.slug}'."
                )

        if params.create_db:
            ensure_database_and_role(
                db_name=tenant.db_name,
                db_user=tenant.db_user,
                db_password=tenant.db_password_ciphertext,
            )
            result["database_created"] = True

        alias = register_tenant_database(tenant)

        if params.run_migrations:
            job.step = "migrating"
            job.save(update_fields=["step"])
            _run_tenant_migrations(alias)
            call_command("seed_rbac_permissions", database=alias, verbosity=0)
            result["migrations_ran"] = True

        job.step = "creating_superuser"
        job.save(update_fields=["step"])
        superuser, superuser_created = _ensure_tenant_superuser(
            alias=alias,
            username=params.admin_username,
            email=params.admin_email,
            password=params.admin_password,
        )
        _bootstrap_rbac_for_superuser(alias=alias, user_id=superuser.id)
        call_command("backfill_legacy_user_roles", database=alias, verbosity=0)
        result["superuser_created"] = superuser_created

        if params.package_code:
            job.step = "assigning_package"
            job.save(update_fields=["step"])
            _set_subscription(tenant, params.package_code)

        tenant.status = TenantStatus.ACTIVE
        tenant.schema_version = "phase2+phase3+phase4+phase5"
        tenant.save(update_fields=["status", "schema_version", "updated_at"])

        job.state = ProvisioningState.COMPLETED
        job.step = "completed"
        job.finished_at = timezone.now()
        job.save(update_fields=["state", "step", "finished_at"])
        record_audit_event(
            category="provisioning",
            action="tenant.provisioning_completed",
            source="command",
            tenant=tenant,
            object_type="ProvisioningJob",
            object_id=str(job.id),
            payload={
                "database_created": result["database_created"],
                "migrations_ran": result["migrations_ran"],
                "superuser_created": result["superuser_created"],
            },
        )
    except Exception as exc:
        tenant.status = TenantStatus.FAILED
        tenant.save(update_fields=["status", "updated_at"])

        job.state = ProvisioningState.FAILED
        job.step = job.step or "failed"
        job.error_payload = {"error": str(exc)}
        job.finished_at = timezone.now()
        job.save(update_fields=["state", "step", "error_payload", "finished_at"])
        record_audit_event(
            category="provisioning",
            action="tenant.provisioning_failed",
            source="command",
            tenant=tenant,
            object_type="ProvisioningJob",
            object_id=str(job.id),
            payload={"error": str(exc), "step": job.step},
        )
        raise

    return result


def deprovision_tenant(slug: str, *, suspend_only: bool = True, drop_db: bool = False) -> dict:
    tenant = Tenant.objects.filter(slug=slug).first()
    if tenant is None:
        raise ValueError(f"Tenant '{slug}' does not exist.")

    previous_status = tenant.status
    tenant.status = TenantStatus.SUSPENDED if suspend_only else TenantStatus.DELETED
    tenant.save(update_fields=["status", "updated_at"])

    dropped = False
    if drop_db:
        drop_database_and_role(tenant.db_name, tenant.db_user)
        dropped = True

    record_audit_event(
        category="provisioning",
        action="tenant.deprovisioned",
        source="command",
        tenant=tenant,
        object_type="Tenant",
        object_id=str(tenant.id),
        payload={
            "previous_status": previous_status,
            "new_status": tenant.status,
            "database_dropped": dropped,
            "suspend_only": suspend_only,
        },
    )

    return {
        "tenant_slug": slug,
        "previous_status": previous_status,
        "new_status": tenant.status,
        "database_dropped": dropped,
    }
