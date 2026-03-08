from django.conf import settings
from django.http import JsonResponse

from tenant_control.models import TenantDomain, TenantStatus

from .context import clear_current_tenant, set_current_tenant
from .db_registry import register_tenant_database


class TenantResolutionMiddleware:
    """
    Resolve tenant from host and bind tenant DB alias into request-local context.

    Local-first strategy:
    - control.localtest.me is treated as control-plane host.
    - <slug>.localtest.me resolves by tenant slug fallback.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.tenant = None
        request.tenant_db_alias = None

        if not getattr(settings, "MULTI_TENANT_ENABLED", False):
            return self.get_response(request)

        host = request.get_host().split(":", 1)[0].lower()

        control_hosts = set(getattr(settings, "MULTI_TENANT_CONTROL_HOSTS", []))
        if host in control_hosts:
            return self.get_response(request)

        tenant = self._resolve_tenant(host)
        if tenant is None:
            return JsonResponse({"detail": "Tenant not found for host."}, status=404)

        db_alias = register_tenant_database(tenant)
        request.tenant = tenant
        request.tenant_db_alias = db_alias

        tenant_token, alias_token = set_current_tenant(tenant, db_alias)
        try:
            return self.get_response(request)
        finally:
            clear_current_tenant(tenant_token, alias_token)

    def _resolve_tenant(self, host):
        domain = (
            TenantDomain.objects.select_related("tenant")
            .filter(domain__iexact=host, tenant__status=TenantStatus.ACTIVE)
            .first()
        )
        if domain:
            return domain.tenant

        base_domain = getattr(settings, "MULTI_TENANT_BASE_DOMAIN", "localtest.me").lower().strip(".")
        suffix = f".{base_domain}"
        if host.endswith(suffix):
            slug = host[: -len(suffix)]
            if slug and "." not in slug:
                from tenant_control.models import Tenant

                return Tenant.objects.filter(slug=slug, status=TenantStatus.ACTIVE).first()

        return None
