from django.db import models

class SystemInfo(models.Model):
    """Hardware/OS metrics snapshot sent by monitored machines."""
    # Basic System Information
    hostname = models.CharField(max_length=255, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    system = models.CharField(max_length=100, null=True, blank=True, help_text="OS name (Windows, Linux, etc.)")
    version = models.CharField(max_length=255, null=True, blank=True, help_text="OS version")
    release = models.CharField(max_length=100, null=True, blank=True, help_text="OS release")
    machine = models.CharField(max_length=100, null=True, blank=True, help_text="Machine type")
    processor = models.CharField(max_length=255, null=True, blank=True)
    architecture = models.CharField(max_length=50, null=True, blank=True, help_text="32bit/64bit")
    
    # CPU Information
    cpu_physical_cores = models.IntegerField(null=True, blank=True)
    cpu_total_cores = models.IntegerField(null=True, blank=True)
    cpu_max_freq = models.FloatField(null=True, blank=True, help_text="MHz")
    cpu_min_freq = models.FloatField(null=True, blank=True, help_text="MHz")
    cpu_current_freq = models.FloatField(null=True, blank=True, help_text="MHz")
    cpu_usage = models.FloatField(null=True, blank=True, help_text="Percentage 0-100")
    
    # Memory Information
    memory_total = models.FloatField(null=True, blank=True, help_text="GB")
    memory_available = models.FloatField(null=True, blank=True, help_text="GB")
    memory_used = models.FloatField(null=True, blank=True, help_text="GB")
    memory_usage_percent = models.FloatField(null=True, blank=True, help_text="Percentage 0-100")
    
    # Disk Information
    disk_total = models.FloatField(null=True, blank=True, help_text="GB")
    disk_used = models.FloatField(null=True, blank=True, help_text="GB")
    disk_free = models.FloatField(null=True, blank=True, help_text="GB")
    disk_usage_percent = models.FloatField(null=True, blank=True, help_text="Percentage 0-100")
    
    # Network Information
    bytes_sent = models.BigIntegerField(null=True, blank=True)
    bytes_received = models.BigIntegerField(null=True, blank=True)
    
    # User Information
    users_count = models.IntegerField(null=True, blank=True)
    logged_in_users = models.TextField(null=True, blank=True)
    
    # Timestamp
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        get_latest_by = 'timestamp'
        indexes = [
            models.Index(fields=['hostname', '-timestamp']),
        ]

    def __str__(self):
        return f"{self.hostname} @ {self.timestamp:%Y-%m-%d %H:%M:%S}"