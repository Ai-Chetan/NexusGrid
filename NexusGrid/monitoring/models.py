from django.db import models

class SystemInfo(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)

    mac_address = models.CharField(max_length=17, unique=True)

    # System Information
    hostname = models.CharField(max_length=255)
    system = models.CharField(max_length=50)
    version = models.TextField()
    release = models.CharField(max_length=100)
    machine = models.CharField(max_length=50)
    processor = models.CharField(max_length=255)
    architecture = models.CharField(max_length=50)

    # CPU Information
    physical_cores = models.IntegerField()
    total_cores = models.IntegerField()
    max_frequency = models.FloatField()
    min_frequency = models.FloatField()
    current_frequency = models.FloatField()
    cpu_usage = models.FloatField()

    # Memory Information
    total_memory = models.FloatField()
    available_memory = models.FloatField()
    used_memory = models.FloatField()
    memory_usage = models.FloatField()

    # Disk Information
    total_disk_space = models.FloatField()
    used_disk_space = models.FloatField()
    free_disk_space = models.FloatField()
    disk_usage = models.FloatField()

    # Network Information
    ip_address = models.GenericIPAddressField()
    bytes_sent = models.BigIntegerField()
    bytes_received = models.BigIntegerField()

    # User Information
    current_users = models.IntegerField()
    logged_in_users = models.TextField()  # Store usernames as a comma-separated string

    def __str__(self):
        return f"System Info at {self.timestamp}"
