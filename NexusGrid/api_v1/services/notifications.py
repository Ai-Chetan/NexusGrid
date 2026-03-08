from __future__ import annotations

from datetime import timedelta
from typing import Iterable

from django.contrib.auth import get_user_model
from django.db.models import Q
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
    return list(
        User.objects.filter(
            Q(is_superuser=True)
            | Q(role='Administrator')
            | Q(rbac_roles__role__name='Administrator')
            | Q(rbac_roles__role__name='role.admin')
        )
        .distinct()
        .values_list('id', flat=True)
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
    recipients = admin_user_ids()
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
