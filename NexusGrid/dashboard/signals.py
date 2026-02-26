"""
Cache invalidation signals for the dashboard.

Whenever a FaultReport, ResourceRequest, or System record changes,
the three dashboard caches are cleared so the next page load reflects
fresh data immediately instead of waiting for the TTL to expire.
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache

from faults.models import FaultReport
from resources.models import ResourceRequest
from system_layout.models import System

_DASHBOARD_CACHE_KEYS = ['dashboard_metrics', 'dashboard_charts', 'recent_activity']


def _invalidate_dashboard_caches(**_kwargs):
    cache.delete_many(_DASHBOARD_CACHE_KEYS)


@receiver([post_save, post_delete], sender=FaultReport)
def on_fault_change(sender, **kwargs):
    _invalidate_dashboard_caches()


@receiver([post_save, post_delete], sender=ResourceRequest)
def on_resource_change(sender, **kwargs):
    _invalidate_dashboard_caches()


@receiver([post_save, post_delete], sender=System)
def on_system_change(sender, **kwargs):
    _invalidate_dashboard_caches()
