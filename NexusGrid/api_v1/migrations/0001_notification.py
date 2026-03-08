from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message', models.TextField()),
                ('related_to', models.CharField(choices=[('fault_report', 'Fault Report'), ('fault_status_update', 'Fault Report Status Update'), ('resource_request', 'Resource Request'), ('resource_status_update', 'Resource Request Status Update'), ('admin_message', 'Admin Message'), ('system_alert', 'System Alert')], max_length=40)),
                ('related_id', models.PositiveIntegerField(blank=True, null=True)),
                ('target_url', models.CharField(blank=True, default='', max_length=255)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='created_notifications', to=settings.AUTH_USER_MODEL)),
                ('recipient', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['recipient', 'is_read'], name='api_v1_noti_recipie_b5ef40_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['related_to', 'related_id'], name='api_v1_noti_related_30fb3a_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['created_at'], name='api_v1_noti_created_e46fba_idx'),
        ),
    ]
