from django.core.management.base import BaseCommand

from rbac.models import Permission


DEFAULT_PERMISSIONS = [
    ("dashboard.view", "dashboard", "view", "View dashboard metrics"),
    ("layout.view", "layout", "view", "View system layout"),
    ("layout.edit", "layout", "edit", "Modify layout structure and metadata"),
    ("faults.view", "faults", "view", "View fault reports"),
    ("faults.create", "faults", "create", "Create fault reports"),
    ("faults.update", "faults", "update", "Update fault status and resolution"),
    ("resources.view", "resources", "view", "View resource requests"),
    ("resources.create", "resources", "create", "Create resource requests"),
    ("resources.update", "resources", "update", "Update resource request status"),
    ("monitoring.view", "monitoring", "view", "View monitoring data"),
    ("reports.view", "reports", "view", "View reports"),
    ("users.view", "users", "view", "View users"),
    ("users.manage", "users", "manage", "Create/update users and assignments"),
    ("rbac.manage", "rbac", "manage", "Manage roles and permissions"),
    ("features.manage", "features", "manage", "Manage feature toggles and packages"),
]


class Command(BaseCommand):
    help = "Seed default RBAC permissions into the active database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--database",
            default="default",
            help="Database alias to seed permissions into.",
        )

    def handle(self, *args, **options):
        db_alias = options["database"]
        created_count = 0
        for code, module, action, description in DEFAULT_PERMISSIONS:
            _, created = Permission.objects.db_manager(db_alias).get_or_create(
                code=code,
                defaults={
                    "module": module,
                    "action": action,
                    "description": description,
                },
            )
            if created:
                created_count += 1

        self.stdout.write(self.style.SUCCESS(f"RBAC permission seed completed. Created: {created_count}"))
