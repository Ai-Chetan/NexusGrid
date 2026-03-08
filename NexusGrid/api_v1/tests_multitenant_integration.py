import copy
import os
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connections
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from faults.models import FaultReport
from rbac.models import Permission, Role, RolePermission, UserRole
from resources.models import ResourceRequest
from system_layout.models import Lab, LayoutItem, System
from tenant_control.models import (
    Feature,
    Package,
    PackageFeature,
    Tenant,
    TenantDomain,
    TenantStatus,
    TenantSubscription,
)


MT_DATABASES = copy.deepcopy(settings.DATABASES)
DEFAULT_TEST_SETTINGS = {
    "CHARSET": None,
    "COLLATION": None,
    "MIGRATE": True,
    "MIRROR": None,
    "NAME": None,
}
MT_DATABASES["tenant_acme_test"] = {
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": os.path.join(settings.BASE_DIR, "test_tenant_acme.sqlite3"),
    "USER": "",
    "PASSWORD": "",
    "HOST": "",
    "PORT": "",
    "TIME_ZONE": None,
    "AUTOCOMMIT": True,
    "ATOMIC_REQUESTS": False,
    "CONN_MAX_AGE": 0,
    "CONN_HEALTH_CHECKS": False,
    "OPTIONS": {},
    "TEST": {
        **DEFAULT_TEST_SETTINGS,
        "NAME": os.path.join(settings.BASE_DIR, "test_tenant_acme_test.sqlite3"),
    },
}
MT_DATABASES["tenant_beta_test"] = {
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": os.path.join(settings.BASE_DIR, "test_tenant_beta.sqlite3"),
    "USER": "",
    "PASSWORD": "",
    "HOST": "",
    "PORT": "",
    "TIME_ZONE": None,
    "AUTOCOMMIT": True,
    "ATOMIC_REQUESTS": False,
    "CONN_MAX_AGE": 0,
    "CONN_HEALTH_CHECKS": False,
    "OPTIONS": {},
    "TEST": {
        **DEFAULT_TEST_SETTINGS,
        "NAME": os.path.join(settings.BASE_DIR, "test_tenant_beta_test.sqlite3"),
    },
}

# Register aliases early so Django's test runner can validate/model-check them.
settings.DATABASES.update({
    "tenant_acme_test": MT_DATABASES["tenant_acme_test"],
    "tenant_beta_test": MT_DATABASES["tenant_beta_test"],
})
connections.databases["tenant_acme_test"] = settings.DATABASES["tenant_acme_test"]
connections.databases["tenant_beta_test"] = settings.DATABASES["tenant_beta_test"]


@override_settings(
    MULTI_TENANT_ENABLED=True,
    ALLOWED_HOSTS=["testserver", ".localtest.me", "acme.localtest.me", "beta.localtest.me"],
)
class MultiTenantApiIsolationTests(TransactionTestCase):
    databases = {"default", "tenant_acme_test", "tenant_beta_test"}

    TENANT_A_ALIAS = "tenant_acme_test"
    TENANT_B_ALIAS = "tenant_beta_test"

    @classmethod
    def _mock_register_tenant_database(cls, tenant):
        if tenant.slug == "acme":
            return cls.TENANT_A_ALIAS
        if tenant.slug == "beta":
            return cls.TENANT_B_ALIAS
        raise AssertionError(f"Unexpected tenant slug in test: {tenant.slug}")

    def setUp(self):
        self._patcher = patch(
            "NexusGrid.tenant.middleware.register_tenant_database",
            side_effect=self._mock_register_tenant_database,
        )
        self._patcher.start()
        self._seed_control_plane()
        self.user_a, self.user_b = self._seed_tenant_users_same_username()
        self._seed_tenant_permissions()

    def tearDown(self):
        self._patcher.stop()
        super().tearDown()

    def _seed_control_plane(self):
        self.tenant_a = Tenant.objects.create(
            slug="acme",
            name="ACME",
            status=TenantStatus.ACTIVE,
            db_name="ignored_in_test_acme",
            db_host="127.0.0.1",
            db_port=5432,
            db_user="acme_user",
            db_password_ciphertext="x",
        )
        self.tenant_b = Tenant.objects.create(
            slug="beta",
            name="BETA",
            status=TenantStatus.ACTIVE,
            db_name="ignored_in_test_beta",
            db_host="127.0.0.1",
            db_port=5432,
            db_user="beta_user",
            db_password_ciphertext="x",
        )
        TenantDomain.objects.create(tenant=self.tenant_a, domain="acme.localtest.me", is_primary=True)
        TenantDomain.objects.create(tenant=self.tenant_b, domain="beta.localtest.me", is_primary=True)

        feature_rbac, _ = Feature.objects.get_or_create(
            code="rbac",
            defaults={"module_key": "rbac", "description": "RBAC module"},
        )
        feature_faults, _ = Feature.objects.get_or_create(
            code="faults",
            defaults={"module_key": "faults", "description": "Fault module"},
        )
        feature_resources, _ = Feature.objects.get_or_create(
            code="resources",
            defaults={"module_key": "resources", "description": "Resource module"},
        )
        package_pro, _ = Package.objects.get_or_create(code="pro", defaults={"name": "Pro"})
        package_starter, _ = Package.objects.get_or_create(code="starter", defaults={"name": "Starter"})
        PackageFeature.objects.get_or_create(package=package_pro, feature=feature_rbac, defaults={"enabled": True})
        PackageFeature.objects.get_or_create(package=package_starter, feature=feature_rbac, defaults={"enabled": False})
        PackageFeature.objects.get_or_create(package=package_pro, feature=feature_faults, defaults={"enabled": True})
        PackageFeature.objects.get_or_create(package=package_starter, feature=feature_faults, defaults={"enabled": True})
        PackageFeature.objects.get_or_create(package=package_pro, feature=feature_resources, defaults={"enabled": True})
        PackageFeature.objects.get_or_create(package=package_starter, feature=feature_resources, defaults={"enabled": True})

        TenantSubscription.objects.create(tenant=self.tenant_a, package=package_pro, status="active", starts_at=timezone.now())
        TenantSubscription.objects.create(tenant=self.tenant_b, package=package_starter, status="active", starts_at=timezone.now())

    def _seed_tenant_users_same_username(self):
        User = get_user_model()
        user_a = User.objects.db_manager(self.TENANT_A_ALIAS).create_user(
            username="shared.user",
            email="shared+acme@example.com",
            password="TempPass#123",
            role="Administrator",
        )
        user_b = User.objects.db_manager(self.TENANT_B_ALIAS).create_user(
            username="shared.user",
            email="shared+beta@example.com",
            password="TempPass#123",
            role="Administrator",
        )
        return user_a, user_b

    def _seed_tenant_permissions(self):
        perm_a = Permission.objects.db_manager(self.TENANT_A_ALIAS).create(
            code="reports.view",
            module="reports",
            action="view",
            description="View reports",
        )
        perm_b = Permission.objects.db_manager(self.TENANT_B_ALIAS).create(
            code="monitoring.view",
            module="monitoring",
            action="view",
            description="View monitoring",
        )
        for alias, user, permission in (
            (self.TENANT_A_ALIAS, self.user_a, perm_a),
            (self.TENANT_B_ALIAS, self.user_b, perm_b),
        ):
            role = Role.objects.db_manager(alias).create(name="role.viewer", is_system=True)
            RolePermission.objects.db_manager(alias).create(role=role, permission=permission)
            UserRole.objects.db_manager(alias).create(user_id=user.id, role=role, assigned_by_id=user.id)

    def _build_system_for_tenant(self, alias: str, user, suffix: str) -> System:
        building = LayoutItem.objects.db_manager(alias).create(name=f"Building {suffix}", item_type="building")
        floor = LayoutItem.objects.db_manager(alias).create(name=f"Floor {suffix}", item_type="floor", parent=building)
        room = LayoutItem.objects.db_manager(alias).create(name=f"Room {suffix}", item_type="room", parent=floor)
        node = LayoutItem.objects.db_manager(alias).create(name=f"PC {suffix}", item_type="computer", parent=room)
        lab = Lab.objects.db_manager(alias).create(layout_item=room, lab_name=f"Lab {suffix}")
        return System.objects.db_manager(alias).create(
            layout_item=node,
            lab=lab,
            host_name=f"host-{suffix.lower()}",
            status="active",
            updated_by_id=user.id,
        )

    def _seed_faults_and_resources_for_isolation(self):
        system_a = self._build_system_for_tenant(self.TENANT_A_ALIAS, self.user_a, "A")
        system_b = self._build_system_for_tenant(self.TENANT_B_ALIAS, self.user_b, "B")

        FaultReport.objects.db_manager(self.TENANT_A_ALIAS).create(
            system_name_id=system_a.id,
            reported_by_id=self.user_a.id,
            fault_type="Hardware",
            risk_factor=2,
            description="A-side hardware fault",
            status="unaddressed",
        )
        FaultReport.objects.db_manager(self.TENANT_B_ALIAS).create(
            system_name_id=system_b.id,
            reported_by_id=self.user_b.id,
            fault_type="Software",
            risk_factor=3,
            description="B-side software fault",
            status="unaddressed",
        )

        ResourceRequest.objects.db_manager(self.TENANT_A_ALIAS).create(
            system_name_id=system_a.id,
            requested_by_id=self.user_a.id,
            resource_name="A-side SSD",
            description="A tenant request",
            status="Pending",
        )
        ResourceRequest.objects.db_manager(self.TENANT_B_ALIAS).create(
            system_name_id=system_b.id,
            requested_by_id=self.user_b.id,
            resource_name="B-side RAM",
            description="B tenant request",
            status="Pending",
        )

    def test_capabilities_follow_host_tenant_context_with_same_username(self):
        # Tenant-local DBs can both contain the same username while capabilities remain host-isolated.
        self.assertEqual(
            get_user_model().objects.db_manager(self.TENANT_A_ALIAS).filter(username="shared.user").count(),
            1,
        )
        self.assertEqual(
            get_user_model().objects.db_manager(self.TENANT_B_ALIAS).filter(username="shared.user").count(),
            1,
        )

        client = APIClient()

        # Authenticate with beta user object, but call ACME host.
        # Router should resolve ACME alias from host, so returned permissions are ACME-specific.
        client.force_authenticate(user=self.user_b)
        resp_a = client.get("/api/v1/auth/capabilities/", HTTP_HOST="acme.localtest.me")
        self.assertEqual(resp_a.status_code, 200)
        self.assertEqual(resp_a.data["tenant"]["slug"], "acme")
        self.assertIn("reports.view", resp_a.data["permissions"])
        self.assertNotIn("monitoring.view", resp_a.data["permissions"])

        # Same authenticated object, now BETA host -> BETA permissions.
        resp_b = client.get("/api/v1/auth/capabilities/", HTTP_HOST="beta.localtest.me")
        self.assertEqual(resp_b.status_code, 200)
        self.assertEqual(resp_b.data["tenant"]["slug"], "beta")
        self.assertIn("monitoring.view", resp_b.data["permissions"])
        self.assertNotIn("reports.view", resp_b.data["permissions"])

    def test_feature_gate_blocks_rbac_endpoint_for_disabled_tenant(self):
        client = APIClient()
        client.force_authenticate(user=self.user_a)

        # ACME has rbac enabled via package_pro.
        resp_enabled = client.get("/api/v1/rbac/permissions/", HTTP_HOST="acme.localtest.me")
        self.assertEqual(resp_enabled.status_code, 200)

        # BETA has rbac disabled via package_starter.
        resp_disabled = client.get("/api/v1/rbac/permissions/", HTTP_HOST="beta.localtest.me")
        self.assertEqual(resp_disabled.status_code, 403)

    def test_faults_list_is_isolated_by_tenant_host(self):
        self._seed_faults_and_resources_for_isolation()

        client = APIClient()
        client.force_authenticate(user=self.user_a)

        resp_a = client.get("/api/v1/faults/", HTTP_HOST="acme.localtest.me")
        self.assertEqual(resp_a.status_code, 200)
        a_results = resp_a.data["results"]
        self.assertEqual(len(a_results), 1)
        self.assertIn("A-side hardware fault", a_results[0]["description"])
        self.assertNotIn("B-side software fault", a_results[0]["description"])

        resp_b = client.get("/api/v1/faults/", HTTP_HOST="beta.localtest.me")
        self.assertEqual(resp_b.status_code, 200)
        b_results = resp_b.data["results"]
        self.assertEqual(len(b_results), 1)
        self.assertIn("B-side software fault", b_results[0]["description"])
        self.assertNotIn("A-side hardware fault", b_results[0]["description"])

    def test_resources_list_is_isolated_by_tenant_host(self):
        self._seed_faults_and_resources_for_isolation()

        client = APIClient()
        client.force_authenticate(user=self.user_a)

        resp_a = client.get("/api/v1/resources/", HTTP_HOST="acme.localtest.me")
        self.assertEqual(resp_a.status_code, 200)
        a_results = resp_a.data["results"]
        self.assertEqual(len(a_results), 1)
        self.assertIn("A-side SSD", a_results[0]["resource_name"])
        self.assertNotIn("B-side RAM", a_results[0]["resource_name"])

        resp_b = client.get("/api/v1/resources/", HTTP_HOST="beta.localtest.me")
        self.assertEqual(resp_b.status_code, 200)
        b_results = resp_b.data["results"]
        self.assertEqual(len(b_results), 1)
        self.assertIn("B-side RAM", b_results[0]["resource_name"])
        self.assertNotIn("A-side SSD", b_results[0]["resource_name"])
