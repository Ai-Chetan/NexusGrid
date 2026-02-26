from django.db import models

class SystemInfo(models.Model):
    """Hardware/OS metrics snapshot sent by monitored machines."""
    hostname = models.CharField(max_length=255, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    os_name = models.CharField(max_length=100, null=True, blank=True)
    os_version = models.CharField(max_length=100, null=True, blank=True)
    cpu_usage = models.FloatField(null=True, blank=True, help_text="Percentage 0-100")
    ram_usage = models.FloatField(null=True, blank=True, help_text="Percentage 0-100")
    disk_usage = models.FloatField(null=True, blank=True, help_text="Percentage 0-100")
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        get_latest_by = 'timestamp'
        indexes = [
            models.Index(fields=['hostname', '-timestamp']),
        ]

    def __str__(self):
        return f"{self.hostname} @ {self.timestamp:%Y-%m-%d %H:%M:%S}"