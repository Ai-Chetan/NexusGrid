from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    # Remove unused fields
    first_name = None
    last_name = None

    # Keep email and ensure uniqueness
    email = models.EmailField(unique=True)

    # Add custom role field
    role = models.CharField(
        max_length=20,
        default='No Roles',
        choices=[
            ('Administrator', 'Administrator'),
            ('Lab Incharge', 'Lab Incharge'),
            ('Lab Assistant', 'Lab Assistant'),
            ('Students', 'Students'),
            ('No Roles', 'No Roles'),
        ],
        db_index=True,
    )

    class Meta:
        ordering = ['username']

    def __str__(self):
        return self.username

class OTPLog(models.Model):
    user_email = models.EmailField()
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    verified = models.BooleanField(default=False)

    def is_expired(self):
        from datetime import timedelta, timezone, datetime
        return self.created_at + timedelta(minutes=5) < datetime.now(timezone.utc)
