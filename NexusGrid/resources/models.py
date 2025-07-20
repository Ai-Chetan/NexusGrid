from django.db import models
from login_manager.models import User  # Correct import for User model
from system_layout.models import System  # Ensure correct reference to System model

class ResourceRequest(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Fulfilled', 'Fulfilled'),
        ('Denied', 'Denied'),
    ]

    resource_id = models.AutoField(primary_key=True)
    system_name = models.ForeignKey(System, on_delete=models.CASCADE)
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE)
    resource_name = models.TextField()
    description = models.TextField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Pending')
    requested_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Resource {self.resource_id} - {self.system_name}"

class Provided(models.Model):
    resource_request = models.OneToOneField(ResourceRequest, on_delete=models.CASCADE)
    provision_summary = models.TextField()
    provided_by = models.ForeignKey(User, on_delete=models.CASCADE)
    provided_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Provided Resource {self.resource_request.resource_id}"