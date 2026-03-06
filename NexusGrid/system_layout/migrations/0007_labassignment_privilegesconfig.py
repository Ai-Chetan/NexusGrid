from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('system_layout', '0006_position_integerfield'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PrivilegesConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('max_labs_per_incharge', models.PositiveIntegerField(
                    default=5,
                    help_text='Maximum number of labs a single Lab Incharge can be concurrently assigned to.',
                )),
                ('max_labs_per_assistant', models.PositiveIntegerField(
                    default=3,
                    help_text='Maximum number of labs a single Lab Assistant can be concurrently assigned to.',
                )),
            ],
            options={'verbose_name': 'Privileges Configuration'},
        ),
        migrations.CreateModel(
            name='LabAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role_type', models.CharField(
                    choices=[('incharge', 'Lab Incharge'), ('assistant', 'Lab Assistant')],
                    max_length=20,
                )),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('start_date', models.DateField(
                    blank=True,
                    null=True,
                    help_text='Leave blank to start immediately.',
                )),
                ('end_date', models.DateField(
                    blank=True,
                    null=True,
                    help_text='Leave blank for an indefinite assignment.',
                )),
                ('lab', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='assignments',
                    to='system_layout.lab',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='lab_assignments',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('assigned_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_assignments',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-assigned_at']},
        ),
    ]
