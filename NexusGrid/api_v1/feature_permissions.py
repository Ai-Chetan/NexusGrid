from rest_framework.permissions import BasePermission

from tenant_control.services.feature_entitlements import is_feature_enabled_for_tenant


class HasFeatureEnabled(BasePermission):
    feature_code = ""
    message = "This feature is not enabled for your tenant."

    def has_permission(self, request, view):
        code = self.feature_code or getattr(view, "required_feature", "")
        if not code:
            return False

        # In single-tenant mode (or when request has no tenant context),
        # preserve backward compatibility by allowing features by default.
        tenant = getattr(request, "tenant", None)
        if tenant is None:
            return True

        return is_feature_enabled_for_tenant(tenant, code)


class HasAnyFeatureEnabled(BasePermission):
    feature_codes: tuple[str, ...] = ()
    message = "This feature set is not enabled for your tenant."

    def has_permission(self, request, view):
        codes = self.feature_codes or tuple(getattr(view, "required_features", ()) or ())
        if not codes:
            return False

        tenant = getattr(request, "tenant", None)
        if tenant is None:
            return True

        return any(is_feature_enabled_for_tenant(tenant, code) for code in codes)


def require_feature(feature_code: str):
    return type(
        "RequiredFeaturePermission",
        (HasFeatureEnabled,),
        {"feature_code": feature_code},
    )


def require_any_feature(*feature_codes: str):
    return type(
        "RequiredAnyFeaturePermission",
        (HasAnyFeatureEnabled,),
        {"feature_codes": tuple(feature_codes)},
    )
