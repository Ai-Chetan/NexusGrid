from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from tenant_control.models import TenantFeatureOverride
from tenant_control.services.audit import record_audit_event


@receiver(post_save, sender=TenantFeatureOverride)
def on_feature_override_saved(sender, instance: TenantFeatureOverride, created: bool, **kwargs):
    record_audit_event(
        category="feature_override",
        action="feature_override.created" if created else "feature_override.updated",
        source="signal",
        tenant=instance.tenant,
        object_type="TenantFeatureOverride",
        object_id=f"{instance.tenant_id}:{instance.feature_id}",
        payload={
            "feature_code": instance.feature.code,
            "enabled": instance.enabled,
            "reason": instance.reason,
        },
    )


@receiver(post_delete, sender=TenantFeatureOverride)
def on_feature_override_deleted(sender, instance: TenantFeatureOverride, **kwargs):
    record_audit_event(
        category="feature_override",
        action="feature_override.deleted",
        source="signal",
        tenant=instance.tenant,
        object_type="TenantFeatureOverride",
        object_id=f"{instance.tenant_id}:{instance.feature_id}",
        payload={
            "feature_code": instance.feature.code,
            "enabled": instance.enabled,
            "reason": instance.reason,
        },
    )
