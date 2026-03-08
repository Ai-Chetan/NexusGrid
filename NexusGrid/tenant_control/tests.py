from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from django.utils import timezone

from api_v1.feature_permissions import require_feature
from rbac.models import Role, UserRole
from rbac.services import ROLE_ADMIN, ROLE_NO_ROLES, sync_user_primary_role_membership
from tenant_control.models import (
    AuditEvent,
    Feature,
    Package,
    PackageFeature,
    Tenant,
    TenantFeatureOverride,
    TenantStatus,
    TenantSubscription,
)
from tenant_control.services.feature_entitlements import (
    get_effective_feature_flags,
    invalidate_feature_cache,
    is_feature_enabled_for_tenant,
)


class FeatureEntitlementServiceTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(
            slug="tenant-a",
            name="Tenant A",
            status=TenantStatus.ACTIVE,
            db_name="tenant_a_db",
            db_host="127.0.0.1",
            db_port=5432,
            db_user="tenant_a_user",
            db_password_ciphertext="x",
        )
        self.feature_faults = Feature.objects.create(code="faults", module_key="faults")
        self.feature_monitoring = Feature.objects.create(code="monitoring", module_key="monitoring")
        self.package = Package.objects.create(code="starter", name="Starter")
        PackageFeature.objects.create(package=self.package, feature=self.feature_faults, enabled=True)
        PackageFeature.objects.create(package=self.package, feature=self.feature_monitoring, enabled=False)
        TenantSubscription.objects.create(
            tenant=self.tenant,
            package=self.package,
            status="active",
            starts_at=timezone.now(),
        )

    def tearDown(self):
        invalidate_feature_cache(self.tenant.id)

    def test_package_feature_flags_applied(self):
        flags = get_effective_feature_flags(self.tenant)
        self.assertTrue(flags["faults"])
        self.assertFalse(flags["monitoring"])

    def test_tenant_override_wins_over_package(self):
        TenantFeatureOverride.objects.create(
            tenant=self.tenant,
            feature=self.feature_monitoring,
            enabled=True,
        )
        invalidate_feature_cache(self.tenant.id)
        self.assertTrue(is_feature_enabled_for_tenant(self.tenant, "monitoring"))


class FeaturePermissionClassTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_no_tenant_context_defaults_to_allowed(self):
        request = self.factory.get("/api/v1/faults/")
        request.tenant = None
        request.user = get_user_model()()
        perm_cls = require_feature("faults")
        self.assertTrue(perm_cls().has_permission(request, view=object()))


class LegacyRoleSyncTests(TestCase):
    def setUp(self):
        self.User = get_user_model()

    def test_sync_user_primary_role_membership_creates_canonical_role(self):
        user = self.User.objects.create_user(
            username="role_sync_user",
            email="role_sync@example.com",
            password="TempPass#123",
            role="Administrator",
        )
        sync_user_primary_role_membership(user, assigned_by_id=user.id)

        self.assertTrue(Role.objects.filter(name=ROLE_ADMIN).exists())
        self.assertTrue(UserRole.objects.filter(user=user, role__name=ROLE_ADMIN).exists())

    def test_sync_removes_previous_transition_roles(self):
        user = self.User.objects.create_user(
            username="role_sync_user_2",
            email="role_sync2@example.com",
            password="TempPass#123",
            role="No Roles",
        )
        role_admin = Role.objects.create(name=ROLE_ADMIN, is_system=True)
        role_no_roles = Role.objects.create(name=ROLE_NO_ROLES, is_system=True)
        UserRole.objects.create(user=user, role=role_admin, assigned_by=user)
        UserRole.objects.create(user=user, role=role_no_roles, assigned_by=user)

        user.role = "Administrator"
        user.save(update_fields=["role"])
        sync_user_primary_role_membership(user, assigned_by_id=user.id)

        self.assertTrue(UserRole.objects.filter(user=user, role__name=ROLE_ADMIN).exists())
        self.assertFalse(UserRole.objects.filter(user=user, role__name=ROLE_NO_ROLES).exists())


class AuditEventSignalTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(
            slug="tenant-audit",
            name="Tenant Audit",
            status=TenantStatus.ACTIVE,
            db_name="tenant_audit_db",
            db_host="127.0.0.1",
            db_port=5432,
            db_user="tenant_audit_user",
            db_password_ciphertext="x",
        )
        self.feature = Feature.objects.create(code="reports", module_key="reports")

    def test_feature_override_signal_creates_audit_event(self):
        TenantFeatureOverride.objects.create(
            tenant=self.tenant,
            feature=self.feature,
            enabled=True,
            reason="Audit test",
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                category="feature_override",
                action="feature_override.created",
                tenant=self.tenant,
            ).exists()
        )
