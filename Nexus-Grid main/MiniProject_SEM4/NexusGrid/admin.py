from django.contrib import admin
from .models import User, Lab, System, FaultReport, ResourceRequest, RepairLog, Notification, PerformanceMetric, EnergyConsumption
# Register your models here.
admin.site.register(User)
admin.site.register(Lab)
admin.site.register(System)
admin.site.register(FaultReport)
admin.site.register(ResourceRequest)
admin.site.register(RepairLog)
admin.site.register(Notification)
admin.site.register(PerformanceMetric)
admin.site.register(EnergyConsumption)
