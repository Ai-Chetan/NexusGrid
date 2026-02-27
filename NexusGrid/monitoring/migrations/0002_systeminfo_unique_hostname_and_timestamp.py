# Generated manually

from django.db import migrations, models


def deduplicate_hostnames(apps, schema_editor):
    """
    Before adding the unique constraint, keep only the most recent row
    per hostname and delete the rest.
    """
    SystemInfo = apps.get_model('monitoring', 'SystemInfo')
    seen = set()
    # Order newest-first so we keep the latest row
    for info in SystemInfo.objects.order_by('-id'):
        if info.hostname in seen:
            info.delete()
        else:
            seen.add(info.hostname)


class Migration(migrations.Migration):

    dependencies = [
        ('monitoring', '0001_initial'),
    ]

    operations = [
        # Populate timestamp for any existing NULL rows (shouldn't exist with
        # auto_now_add but safe to handle)
        migrations.RunPython(deduplicate_hostnames, reverse_code=migrations.RunPython.noop),

        # Remove the old composite index (hostname + timestamp) — no longer useful
        # with one row per hostname
        migrations.AlterUniqueTogether(
            name='systeminfo',
            unique_together=set(),
        ),

        # Change timestamp from auto_now_add to a plain DateTimeField so
        # update_or_create can explicitly set it on each update
        migrations.AlterField(
            model_name='systeminfo',
            name='timestamp',
            field=models.DateTimeField(db_index=True, null=True, blank=True),
        ),

        # Enforce one row per hostname
        migrations.AlterField(
            model_name='systeminfo',
            name='hostname',
            field=models.CharField(db_index=True, max_length=255, unique=True),
        ),
    ]
