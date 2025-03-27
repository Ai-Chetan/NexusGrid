from django.db import models
from .models import System, User


class FaultReport(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Resolved', 'Resolved'),
    ]
    FAULT_CHOICES = [
        ('Hardware', 'Hardware'),
        ('Software', 'Software'),
        ('Network', 'Network'),
    ]
    fault_id = models.AutoField(primary_key=True)
    system_name = models.ForeignKey(System, on_delete=models.CASCADE)
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    fault_type = models.CharField(max_length=50, choices=FAULT_CHOICES)
    description = models.TextField()
    status = models.CharField(max_length=50, choices=STATUS_CHOICES)
    reported_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Fault {self.fault_id} - {self.system_name}"

#Resolved At

from django.db import models
from .models import FaultReport, User


class Resolved(models.Model):
    fault_report = models.ForeignKey(FaultReport, on_delete=models.CASCADE)
    resolution_summary = models.TextField()
    resolved_by = models.ForeignKey(User, on_delete=models.CASCADE)
    resolved_at = models.DateTimeField(auto_now_add=True)
    further_action_required = models.BooleanField(default=False)

    def __str__(self):
        return f"Resolved Fault {self.fault_report.fault_id}"
