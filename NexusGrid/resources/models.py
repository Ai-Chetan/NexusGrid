from django.db import models
from login_manager.models import User  # Correct import for User model
from system_layout.models import LayoutItem  # Ensure correct reference to System model

class ResourceRequest(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]
    RESOURCE_CHOICES = [
        ('Hardware', 'Hardware'),
        ('Software', 'Software'),
        ('Network', 'Network'),
    ]

    resource_id = models.AutoField(primary_key=True)
    system_name = models.ForeignKey(LayoutItem, on_delete=models.CASCADE)
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE)
    resource_type = models.CharField(
        max_length=20, choices=RESOURCE_CHOICES, db_index=True
    )
    description = models.TextField()
    status = models.CharField(
        max_length=30, choices=STATUS_CHOICES, db_index=True
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    provided_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Resource {self.resource_id} - {self.system_name}"
