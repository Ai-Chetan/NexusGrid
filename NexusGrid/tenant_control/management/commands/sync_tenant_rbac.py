from django.core.management import BaseCommand, call_command

from NexusGrid.tenant.db_registry import register_tenant_database
from tenant_control.models import Tenant, TenantStatus


class Command(BaseCommand):
    help = "Apply RBAC schema + seed + legacy backfill for existing tenant databases."

    def add_arguments(self, parser):
        parser.add_argument("--slug", required=False, help="Sync a single tenant slug.")
        parser.add_argument(
            "--include-non-active",
            action="store_true",
            help="Include non-active tenants (default: active only).",
        )

    def handle(self, *args, **options):
        slug = options.get("slug")
        include_non_active = options.get("include_non_active", False)

        tenants = Tenant.objects.all()
        if slug:
            tenants = tenants.filter(slug=slug)
        elif not include_non_active:
            tenants = tenants.filter(status=TenantStatus.ACTIVE)

        total = 0
        for tenant in tenants.iterator():
            alias = register_tenant_database(tenant)
            call_command("migrate", "rbac", database=alias, interactive=False, verbosity=0)
            call_command("seed_rbac_permissions", database=alias, verbosity=0)
            call_command("backfill_legacy_user_roles", database=alias, verbosity=0)
            total += 1
            self.stdout.write(self.style.SUCCESS(f"Synced RBAC for tenant '{tenant.slug}' ({alias})."))

        self.stdout.write(self.style.SUCCESS(f"RBAC sync completed for {total} tenant(s)."))
