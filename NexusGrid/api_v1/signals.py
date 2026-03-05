"""
api_v1/signals.py
-----------------
Cache invalidation for the metrics and monitoring caches.
Connected in ApiV1Config.ready() so the dashboard and reports are always
fresh after any relevant data change — without waiting for the TTL.
comment
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache

from faults.models import FaultReport
from resources.models import ResourceRequest
from system_layout.models import System

# Match the keys defined in api_v1/services/metrics.py
_METRICS_KEYS = ['dashboard_metrics_v1', 'report_metrics_v1']


def _bust_metrics(**_kwargs):
    cache.delete_many(_METRICS_KEYS)


@receiver([post_save, post_delete], sender=FaultReport)
def on_fault_change(sender, **kwargs):
    _bust_metrics()


@receiver([post_save, post_delete], sender=ResourceRequest)
def on_resource_change(sender, **kwargs):
    _bust_metrics()


@receiver([post_save, post_delete], sender=System)
def on_system_change(sender, **kwargs):
    _bust_metrics()
