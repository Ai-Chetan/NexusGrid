from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    role = models.CharField(
        max_length=20,  # Reduced length as role names are short
        default='No Roles',
        choices=[
            ('Administrator', 'Administrator'),
            ('Lab Incharge', 'Lab Incharge'),
            ('Lab Assistant', 'Lab Assistant'),
            ('Students', 'Students'),
            ('No Roles', 'No Roles')
        ],
        db_column="role",
        db_index=True  # Indexing for better performance in filters
    )

    class Meta:
        ordering = ['username']  # Default ordering in queries

    def __str__(self):
        return self.username
