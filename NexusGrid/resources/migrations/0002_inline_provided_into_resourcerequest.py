# Generated manually — inlines Provided into ResourceRequest

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def copy_provided_to_resource(apps, schema_editor):
    """Copy data from the Provided table into the new ResourceRequest columns."""
    Provided = apps.get_model('resources', 'Provided')
    ResourceRequest = apps.get_model('resources', 'ResourceRequest')
    db_alias = schema_editor.connection.alias
    for provided in Provided.objects.using(db_alias).all().values(
        'resource_request_id', 'provision_summary', 'provided_by_id', 'provided_at'
    ):
        ResourceRequest.objects.using(db_alias).filter(pk=provided['resource_request_id']).update(
            provision_summary=provided['provision_summary'],
            provided_by_id=provided['provided_by_id'],
            provided_at=provided['provided_at'],
        )


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Add the three inline provision columns to ResourceRequest
        migrations.AddField(
            model_name='resourcerequest',
            name='provision_summary',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='resourcerequest',
            name='provided_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='resourcerequest',
            name='provided_at',
            field=models.DateTimeField(blank=True, null=True),
        ),

        # 2. Copy existing provision data across
        migrations.RunPython(copy_provided_to_resource, reverse_code=migrations.RunPython.noop),

        # 3. Drop the now-redundant Provided table
        migrations.DeleteModel(name='Provided'),

        # 4. Fix related_name on requested_by to avoid clash
        migrations.AlterField(
            model_name='resourcerequest',
            name='requested_by',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='resource_requests',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
