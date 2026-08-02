from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from monitoring.models import SystemCurrent
from system_layout.models import MonitoringConfig


class Command(BaseCommand):
    help = 'Mark hosts offline when last_seen_at is older than the configured threshold.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--timeout-minutes',
            type=int,
            default=None,
            help='Minutes after last_seen_at to mark a host as offline. '
                 'If not provided, uses MonitoringConfig.offline_detection_threshold_minutes.',
        )

    def handle(self, *args, **options):
        timeout_minutes = options['timeout_minutes']
        if timeout_minutes is None:
            config = MonitoringConfig.get_config()
            timeout_minutes = config.offline_detection_threshold_minutes
        timeout_minutes = max(1, int(timeout_minutes))
        cutoff = timezone.now() - timedelta(minutes=timeout_minutes)

        # Get hostnames that will be marked offline
        offline_hostnames = list(SystemCurrent.objects.filter(
            last_seen_at__lt=cutoff,
            health_state=SystemCurrent.STATE_ONLINE,
        ).values_list('hostname', flat=True))

        updated = SystemCurrent.objects.filter(
            last_seen_at__lt=cutoff,
            health_state=SystemCurrent.STATE_ONLINE,
        ).update(health_state=SystemCurrent.STATE_OFFLINE)

        # Mark corresponding Systems as 'non-functional'
        if offline_hostnames:
            from system_layout.models import System
            System.objects.filter(host_name__in=offline_hostnames).update(status='non-functional')

        self.stdout.write(self.style.SUCCESS(f'Marked {updated} host(s) offline and non-functional.'))
