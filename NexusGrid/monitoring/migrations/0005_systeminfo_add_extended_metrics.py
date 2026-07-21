from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('monitoring', '0004_rename_disk_usage_systeminfo_memory_usage_percent_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='''
                        ALTER TABLE monitoring_systeminfo ADD COLUMN IF NOT EXISTS cpu_load_avg jsonb;
                        ALTER TABLE monitoring_systeminfo ADD COLUMN IF NOT EXISTS swap_total double precision;
                        ALTER TABLE monitoring_systeminfo ADD COLUMN IF NOT EXISTS swap_used double precision;
                        ALTER TABLE monitoring_systeminfo ADD COLUMN IF NOT EXISTS swap_usage_percent double precision;
                        ALTER TABLE monitoring_systeminfo ADD COLUMN IF NOT EXISTS disk_read_bytes bigint;
                        ALTER TABLE monitoring_systeminfo ADD COLUMN IF NOT EXISTS disk_write_bytes bigint;
                        ALTER TABLE monitoring_systeminfo ADD COLUMN IF NOT EXISTS top_processes jsonb;
                        ALTER TABLE monitoring_systeminfo ADD COLUMN IF NOT EXISTS gpu_available boolean;
                        ALTER TABLE monitoring_systeminfo ADD COLUMN IF NOT EXISTS gpu_stats jsonb;
                    ''',
                    reverse_sql='''
                        ALTER TABLE monitoring_systeminfo DROP COLUMN IF EXISTS gpu_stats;
                        ALTER TABLE monitoring_systeminfo DROP COLUMN IF EXISTS gpu_available;
                        ALTER TABLE monitoring_systeminfo DROP COLUMN IF EXISTS top_processes;
                        ALTER TABLE monitoring_systeminfo DROP COLUMN IF EXISTS disk_write_bytes;
                        ALTER TABLE monitoring_systeminfo DROP COLUMN IF EXISTS disk_read_bytes;
                        ALTER TABLE monitoring_systeminfo DROP COLUMN IF EXISTS swap_usage_percent;
                        ALTER TABLE monitoring_systeminfo DROP COLUMN IF EXISTS swap_used;
                        ALTER TABLE monitoring_systeminfo DROP COLUMN IF EXISTS swap_total;
                        ALTER TABLE monitoring_systeminfo DROP COLUMN IF EXISTS cpu_load_avg;
                    ''',
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='systeminfo',
                    name='cpu_load_avg',
                    field=models.JSONField(blank=True, help_text='System load average values', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='swap_total',
                    field=models.FloatField(blank=True, help_text='GB', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='swap_used',
                    field=models.FloatField(blank=True, help_text='GB', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='swap_usage_percent',
                    field=models.FloatField(blank=True, help_text='Percentage 0-100', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='disk_read_bytes',
                    field=models.BigIntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='disk_write_bytes',
                    field=models.BigIntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='top_processes',
                    field=models.JSONField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='gpu_available',
                    field=models.BooleanField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='gpu_stats',
                    field=models.JSONField(blank=True, null=True),
                ),
            ],
        ),
    ]
