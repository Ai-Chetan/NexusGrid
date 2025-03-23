from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    role = models.CharField(
        max_length=50,
        default='No Roles',
        choices=[
            ('Administrator', 'Administrator'),
            ('Lab Incharge', 'Lab Incharge'),
            ('Lab Assistant', 'Lab Assistant'),
            ('Student', 'Student'),
            ('No Roles', 'No Roles')
        ]
    )

    def __str__(self):
        return self.username