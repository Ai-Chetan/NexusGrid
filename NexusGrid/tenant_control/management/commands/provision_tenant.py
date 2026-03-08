from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError

from tenant_control.services.provisioning import ProvisionTenantParams, generate_secret, provision_tenant


class Command(BaseCommand):
    help = "Provision a tenant database, run tenant migrations, and create initial superuser."

    def add_arguments(self, parser):
        parser.add_argument("--slug", required=True, help="Tenant slug, e.g. acme")
        parser.add_argument("--name", required=False, help="Tenant display name")
        parser.add_argument("--domain", required=False, help="Primary tenant domain, e.g. acme.localtest.me")

        parser.add_argument("--admin-username", required=True, help="Initial superuser username")
        parser.add_argument("--admin-email", required=True, help="Initial superuser email")
        parser.add_argument("--admin-password", required=False, help="Initial superuser password")

        parser.add_argument("--package", required=False, help="Optional package code to assign")

        parser.add_argument("--db-name", required=False, help="Override tenant DB name")
        parser.add_argument("--db-user", required=False, help="Override tenant DB user")
        parser.add_argument("--db-password", required=False, help="Override tenant DB password")
        parser.add_argument("--db-host", required=False, help="Override tenant DB host")
        parser.add_argument("--db-port", required=False, type=int, help="Override tenant DB port")

        parser.add_argument(
            "--skip-db-create",
            action="store_true",
            help="Skip creating DB/user in PostgreSQL (useful if already created).",
        )
        parser.add_argument(
            "--skip-migrate",
            action="store_true",
            help="Skip running tenant migrations.",
        )

    def handle(self, *args, **options):
        slug = options["slug"].strip().lower()
        if not slug:
            raise CommandError("--slug must not be empty")

        lock_key = f"tenant_control:provision:{slug}"
        if not cache.add(lock_key, "1", timeout=getattr(settings, "PROVISION_TENANT_RATE_LIMIT_SECONDS", 30)):
            raise CommandError("Provisioning is rate-limited for this tenant. Retry shortly.")

        admin_password = options.get("admin_password") or generate_secret(20)
        generated_password = options.get("admin_password") is None

        params = ProvisionTenantParams(
            slug=slug,
            name=(options.get("name") or slug).strip(),
            domain=options.get("domain"),
            admin_username=options["admin_username"].strip(),
            admin_email=options["admin_email"].strip().lower(),
            admin_password=admin_password,
            package_code=options.get("package"),
            db_name=options.get("db_name"),
            db_user=options.get("db_user"),
            db_password=options.get("db_password"),
            db_host=options.get("db_host"),
            db_port=options.get("db_port"),
            create_db=not options.get("skip_db_create", False),
            run_migrations=not options.get("skip_migrate", False),
        )

        try:
            result = provision_tenant(params)
        except Exception as exc:
            raise CommandError(f"Provisioning failed: {exc}") from exc

        self.stdout.write(self.style.SUCCESS("Tenant provisioning completed."))
        self.stdout.write(f"Tenant: {result['tenant_slug']}")
        self.stdout.write(f"Provisioning Job ID: {result['job_id']}")
        self.stdout.write(f"Database created/verified: {result['database_created']}")
        self.stdout.write(f"Migrations ran: {result['migrations_ran']}")
        self.stdout.write(f"Superuser created: {result['superuser_created']}")

        if generated_password:
            self.stdout.write(self.style.WARNING("Generated superuser password (store securely):"))
            self.stdout.write(admin_password)
