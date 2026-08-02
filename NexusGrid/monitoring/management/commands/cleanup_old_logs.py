from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from monitoring.models import SystemInfo
from system_layout.models import MonitoringConfig


class Command(BaseCommand):
    help = 'Delete SystemInfo records older than the configured max_log_retention_days.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--retention-days',
            type=int,
            default=None,
            help='Days of logs to retain. '
                 'If not provided, uses MonitoringConfig.max_log_retention_days.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Show how many records would be deleted without actually deleting them.',
        )

    def handle(self, *args, **options):
        retention_days = options['retention_days']
        if retention_days is None:
            config = MonitoringConfig.get_config()
            retention_days = config.max_log_retention_days
        retention_days = max(1, int(retention_days))

        cutoff = timezone.now() - timedelta(days=retention_days)
        queryset = SystemInfo.objects.filter(timestamp__lt=cutoff)

        if options['dry_run']:
            count = queryset.count()
            self.stdout.write(
                self.style.WARNING(
                    f'DRY RUN: Would delete {count} SystemInfo record(s) older than '
                    f'{retention_days} days (cutoff: {cutoff.isoformat()}).'
                )
            )
        else:
            count, _ = queryset.delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Deleted {count} SystemInfo record(s) older than '
                    f'{retention_days} days (cutoff: {cutoff.isoformat()}).'
                )
            )