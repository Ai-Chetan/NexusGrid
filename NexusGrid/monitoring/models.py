from django.db import models

class SystemInfo(models.Model):
    hostname = models.CharField(max_length=255)
    system = models.CharField(max_length=255)
    version = models.TextField()
    release = models.CharField(max_length=255)
    machine = models.CharField(max_length=255)
    processor = models.CharField(max_length=255)
    architecture = models.CharField(max_length=50)
    
    cpu_physical_cores = models.IntegerField()
    cpu_total_cores = models.IntegerField()
    cpu_max_freq = models.FloatField()
    cpu_min_freq = models.FloatField()
    cpu_current_freq = models.FloatField()
    cpu_usage = models.FloatField()
    
    memory_total = models.FloatField()
    memory_available = models.FloatField()
    memory_used = models.FloatField()
    memory_usage_percent = models.FloatField()
    
    disk_total = models.FloatField()
    disk_used = models.FloatField()
    disk_free = models.FloatField()
    disk_usage_percent = models.FloatField()
    
    ip_address = models.GenericIPAddressField()
    bytes_sent = models.BigIntegerField()
    bytes_received = models.BigIntegerField()
    
    users_count = models.IntegerField()
    logged_in_users = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.hostname} - {self.timestamp}"
