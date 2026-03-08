from rest_framework.permissions import BasePermission

from rbac.services import user_has_permission


class IsTenantSuperuser(BasePermission):
    message = "Only tenant superusers can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)


class HasRBACPermission(BasePermission):
    permission_code = ""
    message = "You do not have the required permission."

    def has_permission(self, request, view):
        code = self.permission_code or getattr(view, "required_permission", "")
        if not code:
            return False
        return user_has_permission(request.user, code)


def require_permission(permission_code: str):
    return type(
        "RequiredRBACPermission",
        (HasRBACPermission,),
        {"permission_code": permission_code},
    )
