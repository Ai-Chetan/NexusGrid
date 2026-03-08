from django.db import migrations, models
from django.utils import timezone


def backfill_system_current(apps, schema_editor):
    SystemCurrent = apps.get_model('monitoring', 'SystemCurrent')
    db_alias = schema_editor.connection.alias

    latest_by_key = {}
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, hostname, timestamp
            FROM monitoring_systeminfo
            ORDER BY timestamp DESC NULLS LAST, id DESC
            """
        )
        for info_id, hostname, ts in cursor.fetchall():
            raw_hostname = (hostname or '').strip()
            if not raw_hostname:
                continue
            key = raw_hostname.lower()
            if key in latest_by_key:
                continue
            latest_by_key[key] = (raw_hostname, info_id, ts)

    for key, (hostname, info_id, ts) in latest_by_key.items():
        SystemCurrent.objects.using(db_alias).update_or_create(
            hostname_key=key,
            defaults={
                'hostname': hostname,
                'latest_info_id': info_id,
                'last_seen_at': ts or timezone.now(),
                'health_state': 'online',
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('monitoring', '0002_systeminfo_unique_hostname_and_timestamp'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemCurrent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('hostname_key', models.CharField(db_index=True, max_length=255, unique=True)),
                ('hostname', models.CharField(db_index=True, max_length=255)),
                ('last_seen_at', models.DateTimeField(db_index=True)),
                ('health_state', models.CharField(choices=[('online', 'Online'), ('offline', 'Offline'), ('unknown', 'Unknown')], db_index=True, default='unknown', max_length=16)),
                ('latest_info', models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name='current_rows', to='monitoring.systeminfo')),
            ],
            options={
                'ordering': ['hostname'],
                'indexes': [models.Index(fields=['health_state', '-last_seen_at'], name='monitoring__health__6bcf45_idx')],
            },
        ),
        migrations.RunPython(backfill_system_current, reverse_code=migrations.RunPython.noop),
    ]
