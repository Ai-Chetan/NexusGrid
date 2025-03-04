from django.db import models

# Custom User Model without AbstractUser
class User(models.Model):
    ROLE_CHOICES = [
        ('Admin', 'Admin'),
        ('Instructor', 'Instructor'),
        ('Student', 'Student')
    ]
    user_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    password = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    assigned_lab = models.ForeignKey('Lab', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.username} ({self.role})"


class Lab(models.Model):
    lab_name = models.CharField(max_length=100)
    building_name = models.CharField(max_length=100)
    capacity = models.PositiveIntegerField()

    def __str__(self):
        return self.lab_name


class System(models.Model):
    STATUS_CHOICES = [
        ('Operational', 'Operational'),
        ('Faulty', 'Faulty'),
        ('Off', 'Off')
    ]
    FAULT_TYPE_CHOICES = [
        ('None', 'None'),
        ('Hardware', 'Hardware'),
        ('Software', 'Software'),
        ('Network', 'Network')
    ]
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE)
    system_name = models.CharField(max_length=50)
    ip_address = models.GenericIPAddressField()
    qr_code = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Operational')
    fault_type = models.CharField(max_length=20, choices=FAULT_TYPE_CHOICES, default='None')

    def __str__(self):
        return f"{self.system_name} ({self.lab.lab_name})"


class FaultReport(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Resolved', 'Resolved')
    ]
    system = models.ForeignKey(System, on_delete=models.CASCADE)
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    fault_type = models.CharField(max_length=20, choices=System.FAULT_TYPE_CHOICES)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Report {self.id} - {self.system.system_name}"


class ResourceRequest(models.Model):
    RESOURCE_TYPE_CHOICES = [
        ('Equipment', 'Equipment'),
        ('Software', 'Software')
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected')
    ]
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE)
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE)
    resource_type = models.CharField(max_length=20, choices=RESOURCE_TYPE_CHOICES)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Request {self.id} - {self.resource_type}"


class RepairLog(models.Model):
    fault_report = models.ForeignKey(FaultReport, on_delete=models.CASCADE)
    technician = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'Instructor'})
    repair_notes = models.TextField()
    repair_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Repair Log {self.id} - {self.fault_report.system.system_name}"


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    sent_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification {self.id} for {self.user.username}"


class PerformanceMetric(models.Model):
    system = models.ForeignKey(System, on_delete=models.CASCADE)
    cpu_usage = models.FloatField()
    memory_usage = models.FloatField()
    temperature = models.FloatField()
    network_speed = models.FloatField()
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Performance Metrics for {self.system.system_name}"


class EnergyConsumption(models.Model):
    system = models.ForeignKey(System, on_delete=models.CASCADE)
    power_usage = models.FloatField()
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Energy Consumption for {self.system.system_name}"

