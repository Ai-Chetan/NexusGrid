from django.db import models
from django.utils import timezone
from login_manager.models import User
from system_layout.models import System

class FaultReport(models.Model):
    STATUS_CHOICES = [
        ('unaddressed', 'Unaddressed'),
        ('in-progress', 'In Progress'),
        ('scheduled', 'Scheduled'),
        ('resolved', 'Resolved'),
        ('ignored', 'Ignored'),
    ]
    FAULT_CHOICES = [
        ('Hardware', 'Hardware'),
        ('Software', 'Software'),
        ('Network', 'Network'),
    ]

    fault_id = models.AutoField(primary_key=True)
    system_name = models.ForeignKey(System, on_delete=models.CASCADE)
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    fault_type = models.CharField(max_length=20, choices=FAULT_CHOICES)
    description = models.TextField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='unaddressed')
    reported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-reported_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['reported_at']),
            models.Index(fields=['system_name']),
        ]

    def __str__(self):
        return f"Fault {self.fault_id} - {self.system_name}"

class Resolved(models.Model):
    fault_report = models.OneToOneField(FaultReport, on_delete=models.CASCADE)
    resolution_summary = models.TextField()
    resolved_by = models.ForeignKey(User, on_delete=models.CASCADE)
    resolved_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Resolved Fault {self.fault_report.fault_id}"