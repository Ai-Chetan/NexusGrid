from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('monitoring', '0003_systemcurrent'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RenameIndex(
                    model_name='systemcurrent',
                    new_name='monitoring__health__83c111_idx',
                    old_name='monitoring__health__6bcf45_idx',
                ),
                migrations.RenameField(
                    model_name='systeminfo',
                    old_name='ram_usage',
                    new_name='memory_usage_percent',
                ),
                migrations.RenameField(
                    model_name='systeminfo',
                    old_name='disk_usage',
                    new_name='disk_usage_percent',
                ),
                migrations.RemoveField(
                    model_name='systeminfo',
                    name='os_name',
                ),
                migrations.RemoveField(
                    model_name='systeminfo',
                    name='os_version',
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='architecture',
                    field=models.CharField(blank=True, help_text='32bit/64bit', max_length=50, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='bytes_received',
                    field=models.BigIntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='bytes_sent',
                    field=models.BigIntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='cpu_current_freq',
                    field=models.FloatField(blank=True, help_text='MHz', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='cpu_max_freq',
                    field=models.FloatField(blank=True, help_text='MHz', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='cpu_min_freq',
                    field=models.FloatField(blank=True, help_text='MHz', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='cpu_physical_cores',
                    field=models.IntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='cpu_total_cores',
                    field=models.IntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='disk_free',
                    field=models.FloatField(blank=True, help_text='GB', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='disk_total',
                    field=models.FloatField(blank=True, help_text='GB', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='disk_used',
                    field=models.FloatField(blank=True, help_text='GB', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='logged_in_users',
                    field=models.TextField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='machine',
                    field=models.CharField(blank=True, help_text='Machine type', max_length=100, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='memory_available',
                    field=models.FloatField(blank=True, help_text='GB', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='memory_total',
                    field=models.FloatField(blank=True, help_text='GB', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='memory_used',
                    field=models.FloatField(blank=True, help_text='GB', null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='processor',
                    field=models.CharField(blank=True, max_length=255, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='release',
                    field=models.CharField(blank=True, help_text='OS release', max_length=100, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='system',
                    field=models.CharField(blank=True, help_text='OS name (Windows, Linux, etc.)', max_length=100, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='users_count',
                    field=models.IntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='systeminfo',
                    name='version',
                    field=models.CharField(blank=True, help_text='OS version', max_length=255, null=True),
                ),
                migrations.AlterField(
                    model_name='systeminfo',
                    name='hostname',
                    field=models.CharField(db_index=True, max_length=255),
                ),
                migrations.AlterField(
                    model_name='systeminfo',
                    name='timestamp',
                    field=models.DateTimeField(auto_now_add=True, db_index=True),
                ),
            ],
        ),
    ]
