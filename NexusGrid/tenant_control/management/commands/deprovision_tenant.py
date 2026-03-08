from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError

from tenant_control.services.provisioning import deprovision_tenant


class Command(BaseCommand):
    help = "Suspend or delete a tenant, with optional database drop for local cleanup."

    def add_arguments(self, parser):
        parser.add_argument("--slug", required=True, help="Tenant slug to deprovision")
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Mark tenant as deleted (default is suspended).",
        )
        parser.add_argument(
            "--drop-db",
            action="store_true",
            help="Drop tenant DB and role from local PostgreSQL.",
        )

    def handle(self, *args, **options):
        slug = options["slug"].strip().lower()
        if not slug:
            raise CommandError("--slug must not be empty")

        lock_key = f"tenant_control:deprovision:{slug}"
        if not cache.add(lock_key, "1", timeout=getattr(settings, "DEPROVISION_TENANT_RATE_LIMIT_SECONDS", 30)):
            raise CommandError("Deprovisioning is rate-limited for this tenant. Retry shortly.")

        try:
            result = deprovision_tenant(
                slug,
                suspend_only=not options.get("delete", False),
                drop_db=options.get("drop_db", False),
            )
        except Exception as exc:
            raise CommandError(f"Deprovision failed: {exc}") from exc

        self.stdout.write(self.style.SUCCESS("Tenant deprovision completed."))
        self.stdout.write(f"Tenant: {result['tenant_slug']}")
        self.stdout.write(f"Previous status: {result['previous_status']}")
        self.stdout.write(f"New status: {result['new_status']}")
        self.stdout.write(f"Database dropped: {result['database_dropped']}")
