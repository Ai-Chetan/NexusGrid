from django.core.management.base import BaseCommand

from tenant_control.models import Feature, Package, PackageFeature


DEFAULT_FEATURES = [
    ("dashboard", "dashboard", "Dashboard metrics and insights"),
    ("layout", "layout", "System layout views and management"),
    ("faults", "faults", "Fault reporting and resolution workflows"),
    ("resources", "resources", "Resource request workflows"),
    ("monitoring", "monitoring", "Host monitoring and status history"),
    ("reports", "reports", "Aggregate and trend reporting"),
    ("users", "users", "User and privilege management"),
    ("rbac", "rbac", "Dynamic role and permission management"),
]

PACKAGE_MATRIX = {
    "starter": {
        "dashboard": True,
        "layout": True,
        "faults": True,
        "resources": True,
        "monitoring": False,
        "reports": False,
        "users": True,
        "rbac": False,
    },
    "pro": {
        "dashboard": True,
        "layout": True,
        "faults": True,
        "resources": True,
        "monitoring": True,
        "reports": True,
        "users": True,
        "rbac": True,
    },
    "enterprise": {
        "dashboard": True,
        "layout": True,
        "faults": True,
        "resources": True,
        "monitoring": True,
        "reports": True,
        "users": True,
        "rbac": True,
    },
}


class Command(BaseCommand):
    help = "Seed control-plane feature catalog and default package feature matrix."

    def handle(self, *args, **options):
        created_features = 0
        for code, module_key, description in DEFAULT_FEATURES:
            _, created = Feature.objects.get_or_create(
                code=code,
                defaults={"module_key": module_key, "description": description},
            )
            if created:
                created_features += 1

        created_packages = 0
        created_links = 0
        features_by_code = {f.code: f for f in Feature.objects.all()}

        for package_code, feature_flags in PACKAGE_MATRIX.items():
            package, created = Package.objects.get_or_create(
                code=package_code,
                defaults={"name": package_code.capitalize(), "description": f"{package_code.capitalize()} package"},
            )
            if created:
                created_packages += 1

            for feature_code, enabled in feature_flags.items():
                feature = features_by_code.get(feature_code)
                if not feature:
                    continue
                _, created = PackageFeature.objects.get_or_create(
                    package=package,
                    feature=feature,
                    defaults={"enabled": enabled},
                )
                if created:
                    created_links += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Feature catalog seeded. Features created: {created_features}, packages created: {created_packages}, package-feature links created: {created_links}"
            )
        )
