from django.contrib import admin

from .models import (
    AuditEvent,
    Feature,
    Package,
    PackageFeature,
    ProvisioningJob,
    Tenant,
    TenantDomain,
    TenantFeatureOverride,
    TenantSubscription,
)


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "status", "db_name", "db_host", "db_port", "updated_at")
    search_fields = ("slug", "name", "db_name")
    list_filter = ("status",)


@admin.register(TenantDomain)
class TenantDomainAdmin(admin.ModelAdmin):
    list_display = ("domain", "tenant", "is_primary", "verified_at")
    search_fields = ("domain", "tenant__slug", "tenant__name")
    list_filter = ("is_primary",)


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active", "updated_at")
    search_fields = ("code", "name")
    list_filter = ("is_active",)


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ("code", "module_key")
    search_fields = ("code", "module_key")


@admin.register(PackageFeature)
class PackageFeatureAdmin(admin.ModelAdmin):
    list_display = ("package", "feature", "enabled")
    list_filter = ("enabled", "package")
    search_fields = ("package__code", "feature__code")


@admin.register(TenantSubscription)
class TenantSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("tenant", "package", "status", "starts_at", "ends_at")
    list_filter = ("status", "package")
    search_fields = ("tenant__slug", "package__code")


@admin.register(TenantFeatureOverride)
class TenantFeatureOverrideAdmin(admin.ModelAdmin):
    list_display = ("tenant", "feature", "enabled", "updated_at")
    list_filter = ("enabled",)
    search_fields = ("tenant__slug", "feature__code")


@admin.register(ProvisioningJob)
class ProvisioningJobAdmin(admin.ModelAdmin):
    list_display = ("tenant", "state", "step", "started_at", "finished_at", "created_at")
    list_filter = ("state",)
    search_fields = ("tenant__slug", "step")


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "category", "action", "tenant", "actor_username", "request_id")
    list_filter = ("category", "action", "source")
    search_fields = ("request_id", "actor_username", "object_type", "object_id")
