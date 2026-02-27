from django.db import models
from login_manager.models import User
from system_layout.models import System

class ResourceRequest(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Fulfilled', 'Fulfilled'),
        ('Denied', 'Denied'),
    ]

    resource_id = models.AutoField(primary_key=True)
    system_name = models.ForeignKey(System, on_delete=models.CASCADE)
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='resource_requests')
    resource_name = models.TextField()
    description = models.TextField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Pending')
    requested_at = models.DateTimeField(auto_now_add=True)

    # Provision fields — populated when status becomes 'Fulfilled'
    provision_summary = models.TextField(blank=True, default='')
    provided_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
    )
    provided_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Resource {self.resource_id} - {self.system_name}"
