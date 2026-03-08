from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('faults', '0002_inline_resolved_into_faultreport'),
    ]

    operations = [
        migrations.AddField(
            model_name='faultreport',
            name='risk_factor',
            field=models.PositiveSmallIntegerField(
                choices=[
                    (1, 'Least severe'),
                    (2, 'Low severity'),
                    (3, 'Moderate severity'),
                    (4, 'High severity'),
                    (5, 'Critical severity'),
                ],
                default=1,
            ),
        ),
    ]
