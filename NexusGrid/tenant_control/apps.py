from django.apps import AppConfig


class TenantControlConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "tenant_control"

    def ready(self):
        import tenant_control.signals  # noqa: F401
