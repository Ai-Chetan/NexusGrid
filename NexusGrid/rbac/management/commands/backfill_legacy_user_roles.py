from django.core.management.base import BaseCommand

from login_manager.models import User
from rbac.models import UserRole
from rbac.services import (
    TRANSITION_ROLE_NAMES,
    LEGACY_TO_CANONICAL_ROLE,
    LEGACY_ADMIN_ROLE,
    LEGACY_LAB_ASSISTANT_ROLE,
    LEGACY_LAB_INCHARGE_ROLE,
    ROLE_ADMIN,
    ROLE_LAB_ASSISTANT,
    ROLE_LAB_INCHARGE,
    ROLE_NO_ROLES,
    ROLE_STUDENT,
    ensure_role_in_database,
)


LEGACY_ROLE_NAMES = [
    LEGACY_ADMIN_ROLE,
    LEGACY_LAB_INCHARGE_ROLE,
    LEGACY_LAB_ASSISTANT_ROLE,
    "Students",
    "No Roles",
]

CANONICAL_ROLE_NAMES = [
    ROLE_ADMIN,
    ROLE_LAB_INCHARGE,
    ROLE_LAB_ASSISTANT,
    ROLE_STUDENT,
    ROLE_NO_ROLES,
]


class Command(BaseCommand):
    help = "Backfill legacy login_manager.User.role values into RBAC Role/UserRole mappings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--database",
            default="default",
            help="Database alias where users/roles are backfilled.",
        )

    def handle(self, *args, **options):
        db_alias = options["database"]

        created_roles = 0
        created_user_roles = 0

        for role_name in LEGACY_ROLE_NAMES:
            _, created = ensure_role_in_database(role_name, db_alias=db_alias, is_system=True)
            if created:
                created_roles += 1

        for role_name in CANONICAL_ROLE_NAMES:
            _, created = ensure_role_in_database(role_name, db_alias=db_alias, is_system=True)
            if created:
                created_roles += 1

        users = User.objects.db_manager(db_alias).all()
        for user in users:
            legacy_role = (user.role or "").strip()
            if not legacy_role:
                legacy_role = "No Roles"

            canonical_role_name = LEGACY_TO_CANONICAL_ROLE.get(legacy_role, ROLE_NO_ROLES)
            role, _ = ensure_role_in_database(canonical_role_name, db_alias=db_alias, is_system=True)
            UserRole.objects.db_manager(db_alias).filter(user_id=user.id, role__name__in=TRANSITION_ROLE_NAMES).exclude(
                role_id=role.id
            ).delete()
            _, created = UserRole.objects.db_manager(db_alias).get_or_create(
                user_id=user.id,
                role_id=role.id,
                defaults={"assigned_by_id": user.id},
            )
            if created:
                created_user_roles += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Legacy role backfill completed on '{db_alias}'. Roles created: {created_roles}, user-role links created: {created_user_roles}"
            )
        )
