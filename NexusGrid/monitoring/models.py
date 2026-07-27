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
    cpu_load_avg = models.JSONField(null=True, blank=True, help_text="System load average values")
    
    # Memory Information
    memory_total = models.FloatField(null=True, blank=True, help_text="GB")
    memory_available = models.FloatField(null=True, blank=True, help_text="GB")
    memory_used = models.FloatField(null=True, blank=True, help_text="GB")
    memory_usage_percent = models.FloatField(null=True, blank=True, help_text="Percentage 0-100")
    swap_total = models.FloatField(null=True, blank=True, help_text="GB")
    swap_used = models.FloatField(null=True, blank=True, help_text="GB")
    swap_usage_percent = models.FloatField(null=True, blank=True, help_text="Percentage 0-100")
    
    # Disk Information
    disk_total = models.FloatField(null=True, blank=True, help_text="GB")
    disk_used = models.FloatField(null=True, blank=True, help_text="GB")
    disk_free = models.FloatField(null=True, blank=True, help_text="GB")
    disk_usage_percent = models.FloatField(null=True, blank=True, help_text="Percentage 0-100")
    disk_read_bytes = models.BigIntegerField(null=True, blank=True)
    disk_write_bytes = models.BigIntegerField(null=True, blank=True)
    
    # Network Information
    bytes_sent = models.BigIntegerField(null=True, blank=True)
    bytes_received = models.BigIntegerField(null=True, blank=True)
    top_processes = models.JSONField(null=True, blank=True)
    
    # User Information
    users_count = models.IntegerField(null=True, blank=True)
    logged_in_users = models.TextField(null=True, blank=True)
    gpu_available = models.BooleanField(null=True, blank=True)
    gpu_stats = models.JSONField(null=True, blank=True)
    
    # Uptime
    boot_time = models.FloatField(null=True, blank=True, help_text="Unix timestamp of last system boot")
    uptime_seconds = models.FloatField(null=True, blank=True, help_text="Seconds since last boot at snapshot time")
    today_uptime_seconds = models.FloatField(null=True, blank=True, help_text="Total seconds the PC has been ON today")
    today_uptime_formatted = models.CharField(max_length=50, null=True, blank=True)
    today_date = models.CharField(max_length=20, null=True, blank=True)
    
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


class SystemCurrent(models.Model):
    """Latest-known snapshot pointer and health state for each host."""

    STATE_ONLINE = 'online'
    STATE_OFFLINE = 'offline'
    STATE_UNKNOWN = 'unknown'
    HEALTH_CHOICES = [
        (STATE_ONLINE, 'Online'),
        (STATE_OFFLINE, 'Offline'),
        (STATE_UNKNOWN, 'Unknown'),
    ]

    # Lower-cased, normalized key used for matching and unique lookups.
    hostname_key = models.CharField(max_length=255, unique=True, db_index=True)
    # Original host casing for display.
    hostname = models.CharField(max_length=255, db_index=True)
    latest_info = models.ForeignKey(
        SystemInfo,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='current_rows',
    )
    last_seen_at = models.DateTimeField(db_index=True)
    health_state = models.CharField(max_length=16, choices=HEALTH_CHOICES, default=STATE_UNKNOWN, db_index=True)

    class Meta:
        ordering = ['hostname']
        indexes = [
            models.Index(fields=['health_state', '-last_seen_at']),
        ]

    def __str__(self):
        return f"{self.hostname} ({self.health_state})"