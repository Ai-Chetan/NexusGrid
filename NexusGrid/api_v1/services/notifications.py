from __future__ import annotations

from datetime import timedelta
from typing import Iterable

from django.contrib.auth import get_user_model
from django.utils import timezone

from api_v1.models import Notification


User = get_user_model()


def create_notifications(
    *,
    recipient_ids: Iterable[int],
    message: str,
    related_to: str,
    related_id: int | None = None,
    target_url: str = '',
    created_by_id: int | None = None,
) -> None:
    """Create one notification row per recipient."""
    ids = [rid for rid in set(recipient_ids) if rid]
    if not ids:
        return

    now = timezone.now()
    rows = [
        Notification(
            recipient_id=rid,
            message=message,
            related_to=related_to,
            related_id=related_id,
            target_url=target_url,
            created_by_id=created_by_id,
            created_at=now,
        )
        for rid in ids
    ]
    Notification.objects.bulk_create(rows)


def admin_user_ids() -> list[int]:
    return list(User.objects.filter(role='Administrator').values_list('id', flat=True))


def lab_assistant_ids_for_lab(lab_id: int | None) -> list[int]:
    """Return user IDs of currently-active Lab Assistants assigned to the given lab.

    Returns an empty list when lab_id is None or no active assignments exist.
    """
    if not lab_id:
        return []
    from system_layout.models import LabAssignment
    return list(
        LabAssignment.active_qs()
        .filter(lab_id=lab_id, role_type=LabAssignment.ROLE_ASSISTANT)
        .values_list('user_id', flat=True)
        .distinct()
    )


def create_system_alert_if_needed(*, hostname: str, memory_usage_percent: float | None, threshold: float = 90.0) -> None:
    """Emit a system alert notification for admins when memory usage crosses threshold.

    To avoid noise, only one unread alert with the same message per recipient in the
    last 30 minutes is allowed.
    """
    if memory_usage_percent is None or memory_usage_percent < threshold:
        return

    host = (hostname or '').strip() or 'Unknown host'
    usage = round(float(memory_usage_percent), 1)
    message = f'Auto alert: high RAM usage on {host} ({usage}%).'

    # Notify assistants assigned to the lab that owns this host; admins get it as a log entry.
    from django.db.models import Q
    from django.utils import timezone as _tz
    from system_layout.models import System, LabAssignment

    today = _tz.now().date()
    lab_ids = list(
        System.objects.filter(host_name__iexact=host).values_list('lab_id', flat=True)
    )
    assistant_ids = list(
        LabAssignment.objects
        .filter(lab_id__in=[lid for lid in lab_ids if lid], role_type=LabAssignment.ROLE_ASSISTANT)
        .filter(Q(start_date__isnull=True) | Q(start_date__lte=today))
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        .values_list('user_id', flat=True)
        .distinct()
    )
    recipients = list(set(admin_user_ids()) | set(assistant_ids))
    if not recipients:
        return

    cutoff = timezone.now() - timedelta(minutes=30)
    existing = Notification.objects.filter(
        recipient_id__in=recipients,
        related_to='system_alert',
        message=message,
        created_at__gte=cutoff,
        is_read=False,
    ).values_list('recipient_id', flat=True)
    existing_set = set(existing)
    new_recipients = [rid for rid in recipients if rid not in existing_set]

    create_notifications(
        recipient_ids=new_recipients,
        message=message,
        related_to='system_alert',
        related_id=None,
        target_url='/app/monitoring',
        created_by_id=None,
    )
