from django.contrib import admin
from django.contrib.auth.models import User
from .models import *

admin.site.register(User)
admin.site.register(Lab)
admin.site.register(System)
admin.site.register(FaultReport)
admin.site.register(ResourceRequest)
admin.site.register(RepairLog)
admin.site.register(Notification)
admin.site.register(PerformanceMetric)
admin.site.register(EnergyConsumption)