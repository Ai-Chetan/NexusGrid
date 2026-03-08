from django.core.cache import cache
from django.db import models
from django.utils import timezone

from tenant_control.models import (
    Feature,
    PackageFeature,
    TenantFeatureOverride,
    TenantSubscription,
)


FEATURE_CACHE_TTL_SECONDS = 60


def _cache_key(tenant_id: int) -> str:
    return f"tenant:{tenant_id}:feature_flags:v1"


def get_effective_feature_flags(tenant) -> dict[str, bool]:
    if tenant is None:
        return {}

    key = _cache_key(tenant.id)
    cached = cache.get(key)
    if cached is not None:
        return cached

    now = timezone.now()

    features = list(Feature.objects.all().values_list("id", "code"))
    feature_map = {code: False for _, code in features}

    active_subscription = (
        TenantSubscription.objects.filter(tenant=tenant, status="active")
        .filter(starts_at__lte=now)
        .filter(models.Q(ends_at__isnull=True) | models.Q(ends_at__gte=now))
        .select_related("package")
        .order_by("-starts_at")
        .first()
    )

    if active_subscription is not None:
        package_flags = dict(
            PackageFeature.objects.filter(package=active_subscription.package)
            .values_list("feature__code", "enabled")
        )
        for code, enabled in package_flags.items():
            feature_map[code] = bool(enabled)

    override_flags = dict(
        TenantFeatureOverride.objects.filter(tenant=tenant)
        .values_list("feature__code", "enabled")
    )
    feature_map.update({k: bool(v) for k, v in override_flags.items()})

    cache.set(key, feature_map, FEATURE_CACHE_TTL_SECONDS)
    return feature_map


def is_feature_enabled_for_tenant(tenant, feature_code: str) -> bool:
    flags = get_effective_feature_flags(tenant)
    return bool(flags.get(feature_code, False))


def invalidate_feature_cache(tenant_id: int):
    cache.delete(_cache_key(tenant_id))
