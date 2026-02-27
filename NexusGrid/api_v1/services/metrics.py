"""
api_v1/services/metrics.py
==========================
Centralised query layer for all aggregate and reporting metrics.

Both DashboardMetricsView and ReportsView delegate here, eliminating
the duplicated 10-query logic that previously existed in both views and
also in the legacy dashboard/views.py.

Cache strategy
--------------
  Backend      : django-redis  (see settings.CACHES)
  TTL          : METRICS_CACHE_TTL  (default 5 minutes)
  Keys         : DASHBOARD_CACHE_KEY, REPORTS_CACHE_KEY
  Invalidation : TTL-only for now; signal-based invalidation is Phase 3+

The returned dict shapes are FROZEN — the React frontend depends on them.
Do not rename or remove keys; add new keys only.
"""

from __future__ import annotations

from django.core.cache import cache
from django.db.models import Count, Case, When, IntegerField
from django.db.models.functions import TruncMonth
from django.utils import timezone

from faults.models import FaultReport
from resources.models import ResourceRequest
from system_layout.models import Lab, System

# ── Cache config ──────────────────────────────────────────────────────────────

METRICS_CACHE_TTL: int = 60 * 5          # 5 minutes
DASHBOARD_CACHE_KEY: str = "dashboard_metrics_v1"
REPORTS_CACHE_KEY: str = "report_metrics_v1"


def _pct(n: int, d: int) -> float:
    """Return (n / d) * 100 rounded to 1 dp, or 0.0 if denominator is zero."""
    return round((n / d) * 100, 1) if d else 0.0


# ── Dashboard ─────────────────────────────────────────────────────────────────

def get_dashboard_metrics() -> dict:
    """
    Return the full dashboard metrics payload.

    Fires 10 DB queries on a cold cache, then serves from Redis for up to
    METRICS_CACHE_TTL seconds on subsequent calls.

    Queries executed (cold path):
      1.  System aggregate          (total / functional / critical / active)
      2.  FaultReport aggregate     (open / total)
      3.  ResourceRequest aggregate (pending / total)
      4.  FaultReport trend         (6-month monthly counts)
      5.  ResourceRequest trend     (6-month monthly counts)
      6.  FaultReport by type       (group-by)
      7.  FaultReport by status     (group-by)
      8.  Recent faults             (top-5, select_related)
      9.  Recent resources          (top-5, select_related)
      10. Lab count
    """
    cached = cache.get(DASHBOARD_CACHE_KEY)
    if cached is not None:
        return cached

    # 1 ── System counts
    counts = System.objects.aggregate(
        total=Count('id'),
        functional=Count(Case(When(status__in=['active', 'inactive'], then=1), output_field=IntegerField())),
        critical=Count(Case(When(status='non-functional', then=1), output_field=IntegerField())),
        active=Count(Case(When(status='active', then=1), output_field=IntegerField())),
    )
    total      = counts['total']
    functional = counts['functional']
    critical   = counts['critical']
    active     = counts['active']

    # 2 ── Fault / resource headline counts
    fault_counts = FaultReport.objects.aggregate(
        open=Count(Case(When(status__in=['unaddressed', 'in-progress'], then=1), output_field=IntegerField())),
        total=Count('fault_id'),
    )
    resource_counts = ResourceRequest.objects.aggregate(
        pending=Count(Case(When(status='Pending', then=1), output_field=IntegerField())),
        total=Count('resource_id'),
    )

    # 3 ── 6-month trend lines
    six_months_ago = timezone.now() - timezone.timedelta(days=180)
    fault_trend = list(
        FaultReport.objects
        .filter(reported_at__gte=six_months_ago)
        .annotate(month=TruncMonth('reported_at'))
        .values('month')
        .annotate(count=Count('fault_id'))
        .order_by('month')
    )
    resource_trend = list(
        ResourceRequest.objects
        .filter(requested_at__gte=six_months_ago)
        .annotate(month=TruncMonth('requested_at'))
        .values('month')
        .annotate(count=Count('resource_id'))
        .order_by('month')
    )

    # 4 ── Fault breakdowns
    fault_by_type = dict(
        FaultReport.objects
        .values('fault_type')
        .annotate(n=Count('fault_id'))
        .values_list('fault_type', 'n')
    )
    fault_by_status = dict(
        FaultReport.objects
        .values('status')
        .annotate(n=Count('fault_id'))
        .values_list('status', 'n')
    )

    # 5 ── Recent activity (5 faults + 5 resources, merged and sorted in Python)
    recent_faults = list(
        FaultReport.objects
        .select_related('system_name', 'reported_by')
        .order_by('-reported_at')[:5]
    )
    recent_resources = list(
        ResourceRequest.objects
        .select_related('system_name', 'requested_by')
        .order_by('-requested_at')[:5]
    )

    activity: list[dict] = []
    for f in recent_faults:
        activity.append({
            'type':     'fault',
            'id':       f.fault_id,
            'title':    f'Fault on {f.system_name.host_name or "Unknown"}',
            'subtitle': f.fault_type,
            'status':   f.status,
            'time':     f.reported_at.isoformat(),
            'user':     f.reported_by.username,
        })
    for r in recent_resources:
        activity.append({
            'type':     'resource',
            'id':       r.resource_id,
            'title':    f'Resource: {r.resource_name}',
            'subtitle': r.description[:60] if r.description else '',
            'status':   r.status,
            'time':     r.requested_at.isoformat(),
            'user':     r.requested_by.username,
        })
    activity.sort(key=lambda x: x['time'], reverse=True)

    # 6 ── Labs total
    labs_total = Lab.objects.count()

    # ── Assemble payload (shape is frozen — React frontend depends on it)
    payload = {
        'systems': {
            'total':           total,
            'functional':      functional,
            'critical':        critical,
            'active':          active,
            'functional_pct':  _pct(functional, total),
            'critical_pct':    _pct(critical, total),
            'active_pct':      _pct(active, total),
            'utilization_pct': _pct(active, functional),
        },
        'faults':         fault_counts,
        'resources':      resource_counts,
        'labs_total':     labs_total,
        'fault_trend':    [{'month': x['month'].strftime('%b %Y'), 'count': x['count']} for x in fault_trend],
        'resource_trend': [{'month': x['month'].strftime('%b %Y'), 'count': x['count']} for x in resource_trend],
        'fault_by_type':  fault_by_type,
        'fault_by_status': fault_by_status,
        'recent_activity': activity[:8],
    }

    cache.set(DASHBOARD_CACHE_KEY, payload, METRICS_CACHE_TTL)
    return payload


# ── Reports ───────────────────────────────────────────────────────────────────

def get_report_metrics() -> dict:
    """
    Return the full reports payload.

    Shares domain queries with get_dashboard_metrics but caches under a
    separate key so each can be invalidated independently in the future.
    """
    cached = cache.get(REPORTS_CACHE_KEY)
    if cached is not None:
        return cached

    six_months_ago = timezone.now() - timezone.timedelta(days=180)

    fault_by_status = dict(
        FaultReport.objects.values('status').annotate(n=Count('fault_id')).values_list('status', 'n')
    )
    fault_by_type = dict(
        FaultReport.objects.values('fault_type').annotate(n=Count('fault_id')).values_list('fault_type', 'n')
    )
    resource_by_status = dict(
        ResourceRequest.objects.values('status').annotate(n=Count('resource_id')).values_list('status', 'n')
    )
    system_by_status = dict(
        System.objects.values('status').annotate(n=Count('id')).values_list('status', 'n')
    )
    fault_monthly = list(
        FaultReport.objects
        .filter(reported_at__gte=six_months_ago)
        .annotate(month=TruncMonth('reported_at'))
        .values('month', 'fault_type')
        .annotate(count=Count('fault_id'))
        .order_by('month')
    )
    resource_monthly = list(
        ResourceRequest.objects
        .filter(requested_at__gte=six_months_ago)
        .annotate(month=TruncMonth('requested_at'))
        .values('month')
        .annotate(count=Count('resource_id'))
        .order_by('month')
    )

    payload = {
        'fault_by_status':   fault_by_status,
        'fault_by_type':     fault_by_type,
        'resource_by_status': resource_by_status,
        'system_by_status':  system_by_status,
        'fault_monthly': [
            {'month': x['month'].strftime('%b %Y'), 'type': x['fault_type'], 'count': x['count']}
            for x in fault_monthly
        ],
        'resource_monthly': [
            {'month': x['month'].strftime('%b %Y'), 'count': x['count']}
            for x in resource_monthly
        ],
    }

    cache.set(REPORTS_CACHE_KEY, payload, METRICS_CACHE_TTL)
    return payload


# ── Cache utilities ───────────────────────────────────────────────────────────

def invalidate_metrics_cache() -> None:
    """
    Explicitly evict both metric caches.
    Call this from post_save/post_delete signals (Phase 3) or admin actions
    whenever FaultReport, ResourceRequest, or System records change.
    """
    cache.delete_many([DASHBOARD_CACHE_KEY, REPORTS_CACHE_KEY])
