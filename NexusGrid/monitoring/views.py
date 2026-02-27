import json
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .models import SystemInfo


@login_required(login_url="/login/")
def system_status_api(request):
    """Return the latest SystemInfo snapshot for every known hostname.
    One row per hostname now, so no subquery needed.
    """
    infos = SystemInfo.objects.order_by('hostname')

    data = [
        {
            'hostname': info.hostname,
            'ip_address': info.ip_address,
            'os_name': info.os_name,
            'os_version': info.os_version,
            'cpu_usage': info.cpu_usage,
            'ram_usage': info.ram_usage,
            'disk_usage': info.disk_usage,
            'timestamp': info.timestamp.isoformat(),
        }
        for info in infos
    ]
    return JsonResponse({'systems': data})


@csrf_exempt
@require_POST
def ingest_system_info(request):
    """Agent endpoint: receives hardware metrics POSTed by a monitored machine.
    Uses update_or_create so the table stays at exactly one row per hostname
    instead of growing without bound.
    """
    try:
        from django.utils import timezone
        data = json.loads(request.body)
        hostname = data.get('hostname', '').strip()
        if not hostname:
            return JsonResponse({'error': 'hostname is required'}, status=400)

        SystemInfo.objects.update_or_create(
            hostname=hostname,
            defaults={
                'ip_address': data.get('ip_address'),
                'os_name': data.get('os_name'),
                'os_version': data.get('os_version'),
                'cpu_usage': data.get('cpu_usage'),
                'ram_usage': data.get('ram_usage'),
                'disk_usage': data.get('disk_usage'),
                'timestamp': timezone.now(),
            },
        )
        # Invalidate the monitoring list cache so the next poll gets fresh data
        from django.core.cache import cache
        cache.delete('monitoring_latest_v1')
        return JsonResponse({'status': 'ok'})
    except (json.JSONDecodeError, ValueError) as e:
        return JsonResponse({'error': str(e)}, status=400)
