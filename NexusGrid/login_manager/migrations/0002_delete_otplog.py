# Generated manually — removes the unused OTPLog model.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('login_manager', '0001_initial'),
    ]

    operations = [
        migrations.DeleteModel(
            name='OTPLog',
        ),
    ]
