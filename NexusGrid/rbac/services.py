from rbac.models import Permission, Role, UserRole


LEGACY_ADMIN_ROLE = "Administrator"
LEGACY_LAB_INCHARGE_ROLE = "Lab Incharge"
LEGACY_LAB_ASSISTANT_ROLE = "Lab Assistant"

ROLE_ADMIN = "role.admin"
ROLE_LAB_INCHARGE = "role.lab_incharge"
ROLE_LAB_ASSISTANT = "role.lab_assistant"
ROLE_STUDENT = "role.student"
ROLE_NO_ROLES = "role.no_roles"

LEGACY_TO_CANONICAL_ROLE = {
    LEGACY_ADMIN_ROLE: ROLE_ADMIN,
    LEGACY_LAB_INCHARGE_ROLE: ROLE_LAB_INCHARGE,
    LEGACY_LAB_ASSISTANT_ROLE: ROLE_LAB_ASSISTANT,
    "Students": ROLE_STUDENT,
    "No Roles": ROLE_NO_ROLES,
}

CANONICAL_ROLE_NAMES = {
    ROLE_ADMIN,
    ROLE_LAB_INCHARGE,
    ROLE_LAB_ASSISTANT,
    ROLE_STUDENT,
    ROLE_NO_ROLES,
}

LEGACY_ROLE_NAMES = set(LEGACY_TO_CANONICAL_ROLE.keys())
TRANSITION_ROLE_NAMES = CANONICAL_ROLE_NAMES | LEGACY_ROLE_NAMES


def user_role_names(user):
    if not user or not user.is_authenticated:
        return set()
    return set(UserRole.objects.filter(user=user).values_list("role__name", flat=True))


def user_permission_codes(user):
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser:
        return set(Permission.objects.values_list("code", flat=True))

    return set(
        Permission.objects.filter(permission_roles__role__role_users__user=user)
        .values_list("code", flat=True)
        .distinct()
    )


def user_has_permission(user, permission_code: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True

    return UserRole.objects.filter(
        user=user,
        role__role_permissions__permission__code=permission_code,
    ).exists()


def user_has_any_permission(user, permission_codes):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True

    return UserRole.objects.filter(
        user=user,
        role__role_permissions__permission__code__in=list(permission_codes),
    ).exists()


def user_matches_legacy_or_rbac_role(user, role_name: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "role", None) == role_name:
        return True

    canonical = LEGACY_TO_CANONICAL_ROLE.get(role_name, role_name)
    candidates = {role_name, canonical}
    return UserRole.objects.filter(user=user, role__name__in=candidates).exists()


def is_administrator_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if user_has_permission(user, "users.manage"):
        return True
    return user_matches_legacy_or_rbac_role(user, LEGACY_ADMIN_ROLE)


def is_lab_incharge_or_assistant(user) -> bool:
    return (
        user_matches_legacy_or_rbac_role(user, LEGACY_LAB_INCHARGE_ROLE)
        or user_matches_legacy_or_rbac_role(user, LEGACY_LAB_ASSISTANT_ROLE)
    )


def ensure_role_in_database(role_name: str, *, db_alias: str = "default", is_system: bool = True):
    return Role.objects.db_manager(db_alias).get_or_create(
        name=role_name,
        defaults={"is_system": is_system},
    )


def sync_user_primary_role_membership(user, *, db_alias: str = "default", assigned_by_id: int | None = None):
    """
    Keep one canonical RBAC role in sync with legacy User.role during transition.

    This does not remove custom RBAC roles. It only reconciles canonical
    migrated role names (role.admin, role.lab_incharge, etc.).
    """
    if user is None:
        return None

    legacy_role = (getattr(user, "role", "") or "").strip() or "No Roles"
    canonical_role_name = LEGACY_TO_CANONICAL_ROLE.get(legacy_role, ROLE_NO_ROLES)
    role, _ = ensure_role_in_database(canonical_role_name, db_alias=db_alias, is_system=True)

    UserRole.objects.db_manager(db_alias).filter(user_id=user.id, role__name__in=TRANSITION_ROLE_NAMES).exclude(
        role_id=role.id
    ).delete()

    user_role, _ = UserRole.objects.db_manager(db_alias).get_or_create(
        user_id=user.id,
        role_id=role.id,
        defaults={"assigned_by_id": assigned_by_id or user.id},
    )
    return user_role
