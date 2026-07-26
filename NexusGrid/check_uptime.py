import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NexusGrid.settings')
django.setup()

from monitoring.models import SystemInfo

# Check latest 5 records
records = SystemInfo.objects.order_by('-timestamp')[:5]
print("=== Latest 5 SystemInfo records (counter-based uptime) ===")
for r in records:
    print(f"  Host: {r.hostname} | Time: {r.timestamp} | session_start: {r.boot_time} | uptime_seconds: {r.uptime_seconds}")

# Check if any records have uptime data
has_uptime = SystemInfo.objects.filter(boot_time__isnull=False, uptime_seconds__isnull=False).count()
total = SystemInfo.objects.count()
print(f"\nRecords with uptime data: {has_uptime} / {total}")

# Check the latest record specifically
latest = SystemInfo.objects.order_by('-timestamp').first()
if latest:
    print(f"\nLatest record details:")
    print(f"  ID: {latest.id}")
    print(f"  Hostname: {latest.hostname}")
    print(f"  Timestamp: {latest.timestamp}")
    print(f"  session_start (boot_time): {latest.boot_time}")
    print(f"  uptime_seconds (run_count × 60): {latest.uptime_seconds}")
    print(f"  cpu_usage: {latest.cpu_usage}")
    print(f"  memory_usage_percent: {latest.memory_usage_percent}")