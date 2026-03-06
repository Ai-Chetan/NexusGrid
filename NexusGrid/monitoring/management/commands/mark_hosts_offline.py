from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from monitoring.models import SystemCurrent


class Command(BaseCommand):
    help = 'Mark hosts offline when last_seen_at is older than the configured threshold.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--timeout-seconds',
            type=int,
            default=90,
            help='Seconds after last_seen_at to mark a host as offline (default: 90).',
        )

    def handle(self, *args, **options):
        timeout_seconds = max(1, int(options['timeout_seconds']))
        cutoff = timezone.now() - timedelta(seconds=timeout_seconds)

        updated = SystemCurrent.objects.filter(
            last_seen_at__lt=cutoff,
            health_state=SystemCurrent.STATE_ONLINE,
        ).update(health_state=SystemCurrent.STATE_OFFLINE)

        self.stdout.write(self.style.SUCCESS(f'Marked {updated} host(s) offline.'))
