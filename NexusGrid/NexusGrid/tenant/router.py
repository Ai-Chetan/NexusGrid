from django.conf import settings

from .context import get_current_tenant_db_alias


CONTROL_PLANE_APPS = {
    "tenant_control",
}

TENANT_APPS = {
    "api_v1",
    "login_manager",
    "system_layout",
    "monitoring",
    "faults",
    "resources",
    "rbac",  # planned app for dynamic role/permission tables
}


class TenantDatabaseRouter:
    """
    Routes tenant-scoped apps to the active tenant DB alias.

    Behavior is no-op unless MULTI_TENANT_ENABLED=True.
    """

    def _tenant_alias(self):
        if not getattr(settings, "MULTI_TENANT_ENABLED", False):
            return None
        return get_current_tenant_db_alias()

    def db_for_read(self, model, **hints):
        app_label = model._meta.app_label
        if app_label in CONTROL_PLANE_APPS:
            return "default"

        alias = self._tenant_alias()
        if alias and app_label in TENANT_APPS:
            return alias
        return None

    def db_for_write(self, model, **hints):
        app_label = model._meta.app_label
        if app_label in CONTROL_PLANE_APPS:
            return "default"

        alias = self._tenant_alias()
        if alias and app_label in TENANT_APPS:
            return alias
        return None

    def allow_relation(self, obj1, obj2, **hints):
        db_list = {obj1._state.db, obj2._state.db}
        if len(db_list) == 1:
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if not getattr(settings, "MULTI_TENANT_ENABLED", False):
            return None

        # Keep migration behavior non-breaking by default during transition.
        if not getattr(settings, "MULTI_TENANT_STRICT_MIGRATIONS", False):
            return None

        if app_label in CONTROL_PLANE_APPS:
            return db == "default"
        if app_label in TENANT_APPS:
            return db != "default"
        return None
