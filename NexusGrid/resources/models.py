# from django.db import models
# from .models import System, User


# class ResourceRequest(models.Model):
#     STATUS_CHOICES = [
#         ('Pending', 'Pending'),
#         ('Approved', 'Approved'),
#         ('Rejected', 'Rejected'),
#     ]
#     RESOURCE_CHOICES = [
#         ('Hardware', 'Hardware'),
#         ('Software', 'Software'),
#         ('Network', 'Network'),
#     ]
#     resource_id = models.AutoField(primary_key=True)
#     system_name = models.ForeignKey(System, on_delete=models.CASCADE)
#     requested_by = models.ForeignKey(User, on_delete=models.CASCADE)
#     resource_type = models.CharField(max_length=50, choices=RESOURCE_CHOICES)
#     description = models.TextField()
#     status = models.CharField(max_length=50, choices=STATUS_CHOICES)
#     requested_at = models.DateTimeField(auto_now_add=True)
#     provided_at = models.DateTimeField(null=True, blank=True)

#     def __str__(self):
#         return f"Resource {self.resource_id} - {self.system_name}"
