"""Centralized role constants + DRF permission classes for RBAC.

Single source of truth for role segregation between Administrator, Lab Incharge
and Lab Assistant. Views declare intent via `permission_classes` instead of
copy-pasting inline `request.user.role != 'Administrator'` checks.
"""
from rest_framework.permissions import BasePermission, IsAuthenticated

# Role string constants — must match login_manager.User.role values.
ROLE_ADMIN = 'Administrator'
ROLE_INCHARGE = 'Lab Incharge'
ROLE_ASSISTANT = 'Lab Assistant'
ROLE_STUDENT = 'Students'
ROLE_NONE = 'No Roles'

# Staff = anyone who operates labs (admin + assigned staff).
STAFF_ROLES = (ROLE_ADMIN, ROLE_INCHARGE, ROLE_ASSISTANT)
ASSIGNABLE_ROLES = (ROLE_INCHARGE, ROLE_ASSISTANT)


class IsAdministrator(IsAuthenticated):
    """Authenticated Administrator only."""

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == ROLE_ADMIN


class IsStaffRole(IsAuthenticated):
    """Authenticated Administrator, Lab Incharge or Lab Assistant."""

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role in STAFF_ROLES


class ReadAnyWriteStaff(BasePermission):
    """Any authenticated user may read (GET/HEAD/OPTIONS); only staff may write."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user.role in STAFF_ROLES


class ReadStaffWriteAdmin(BasePermission):
    """Staff may read; only Administrator may write."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.role in STAFF_ROLES
        return request.user.role == ROLE_ADMIN
