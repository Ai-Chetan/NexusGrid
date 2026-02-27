# Generated manually — inlines Resolved into FaultReport

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def copy_resolved_to_fault(apps, schema_editor):
    """Copy data from the Resolved table into the new FaultReport columns."""
    Resolved = apps.get_model('faults', 'Resolved')
    FaultReport = apps.get_model('faults', 'FaultReport')
    for resolved in Resolved.objects.select_related('fault_report').iterator():
        FaultReport.objects.filter(pk=resolved.fault_report_id).update(
            resolution_summary=resolved.resolution_summary,
            resolved_by_id=resolved.resolved_by_id,
            resolved_at=resolved.resolved_at,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('faults', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Add the three inline resolution columns to FaultReport
        migrations.AddField(
            model_name='faultreport',
            name='resolution_summary',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='faultreport',
            name='resolved_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='faultreport',
            name='resolved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),

        # 2. Copy existing resolution data across
        migrations.RunPython(copy_resolved_to_fault, reverse_code=migrations.RunPython.noop),

        # 3. Drop the now-redundant Resolved table
        migrations.DeleteModel(name='Resolved'),

        # 4. Fix related_name on reported_by to avoid clash
        migrations.AlterField(
            model_name='faultreport',
            name='reported_by',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='fault_reports',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
