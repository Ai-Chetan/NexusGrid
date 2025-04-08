from django.db import models
from login_manager.models import User
from system_layout.models import LayoutItem

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

    fault_id = models.AutoField(primary_key=True, db_column="fault_id")
    system_name = models.ForeignKey(LayoutItem, on_delete=models.CASCADE, db_column="system_name_id")
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE, db_column="reported_by_id")
    fault_type = models.CharField(max_length=20, choices=FAULT_CHOICES, db_column="fault_type")
    description = models.TextField(db_column="description")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, db_column="status")
    reported_at = models.DateTimeField(auto_now_add=True, db_column="reported_at")
    resolved_at = models.DateTimeField(null=True, blank=True, db_column="resolved_at")

    def __str__(self):
        return f"Fault {self.fault_id} - {self.system_name}"

class Resolved(models.Model):
    fault_report = models.ForeignKey(FaultReport, on_delete=models.CASCADE, db_column="fault_report_id")
    resolution_summary = models.TextField(db_column="resolution_summary")
    resolved_by = models.ForeignKey(User, on_delete=models.CASCADE, db_column="resolved_by_id")
    resolved_at = models.DateTimeField(auto_now_add=True, db_column="resolved_at")
    further_action_required = models.BooleanField(default=False, db_column="further_action_required")

    def __str__(self):
        return f"Resolved Fault {self.fault_report.fault_id}"
