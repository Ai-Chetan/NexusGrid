from django.contrib import admin
from .models import LayoutItem, Lab, MonitoringConfig, System

admin.site.register(LayoutItem)
admin.site.register(Lab)
admin.site.register(MonitoringConfig)
admin.site.register(System)
