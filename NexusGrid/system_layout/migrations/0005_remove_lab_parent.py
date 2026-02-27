# Generated manually — removes the redundant Lab.parent denormalized field.
# Parent floor info is always available via lab.layout_item.parent.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('system_layout', '0004_add_lab_code'),
    ]

    operations = [
        # Remove the constraint that references the parent field first
        migrations.RemoveConstraint(
            model_name='lab',
            name='unique_lab_name_per_floor',
        ),
        # Remove the denormalized parent FK — derive it via layout_item.parent
        migrations.RemoveField(
            model_name='lab',
            name='parent',
        ),
    ]
