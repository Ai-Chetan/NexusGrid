from django.contrib import admin
from .models import SystemInfo


@admin.register(SystemInfo)
class SystemInfoAdmin(admin.ModelAdmin):
    list_display = ('hostname', 'ip_address', 'cpu_usage', 'memory_usage_percent', 'disk_usage_percent', 'timestamp')
    list_filter = ('hostname',)
    readonly_fields = ('timestamp',)
    ordering = ('-timestamp',)
