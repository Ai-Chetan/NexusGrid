import json
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db.models import Max
from .models import SystemInfo


@login_required(login_url="/login/")
def system_status_api(request):
    """Return the latest SystemInfo snapshot for every known hostname."""
    latest_ids = (
        SystemInfo.objects
        .values('hostname')
        .annotate(max_id=Max('id'))
        .values_list('max_id', flat=True)
    )
    infos = SystemInfo.objects.filter(id__in=latest_ids).order_by('hostname')

    data = [
        {
            'hostname': info.hostname,
            'ip_address': info.ip_address,
            'system': info.system,
            'version': info.version,
            'release': info.release,
            'machine': info.machine,
            'processor': info.processor,
            'architecture': info.architecture,
            'cpu_physical_cores': info.cpu_physical_cores,
            'cpu_total_cores': info.cpu_total_cores,
            'cpu_max_freq': info.cpu_max_freq,
            'cpu_min_freq': info.cpu_min_freq,
            'cpu_current_freq': info.cpu_current_freq,
            'cpu_usage': info.cpu_usage,
            'memory_total': info.memory_total,
            'memory_available': info.memory_available,
            'memory_used': info.memory_used,
            'memory_usage_percent': info.memory_usage_percent,
            'disk_total': info.disk_total,
            'disk_used': info.disk_used,
            'disk_free': info.disk_free,
            'disk_usage_percent': info.disk_usage_percent,
            'bytes_sent': info.bytes_sent,
            'bytes_received': info.bytes_received,
            'users_count': info.users_count,
            'logged_in_users': info.logged_in_users,
            'timestamp': info.timestamp.isoformat(),
        }
        for info in infos
    ]
    return JsonResponse({'systems': data})


@csrf_exempt
@require_POST
def ingest_system_info(request):
    """Agent endpoint: receives hardware metrics POSTed by a monitored machine."""
    try:
        data = json.loads(request.body)
        hostname = data.get('hostname', '').strip()
        if not hostname:
            return JsonResponse({'error': 'hostname is required'}, status=400)

        SystemInfo.objects.create(
            hostname=hostname,
            ip_address=data.get('ip_address'),
            system=data.get('system'),
            version=data.get('version'),
            release=data.get('release'),
            machine=data.get('machine'),
            processor=data.get('processor'),
            architecture=data.get('architecture'),
            cpu_physical_cores=data.get('cpu_physical_cores'),
            cpu_total_cores=data.get('cpu_total_cores'),
            cpu_max_freq=data.get('cpu_max_freq'),
            cpu_min_freq=data.get('cpu_min_freq'),
            cpu_current_freq=data.get('cpu_current_freq'),
            cpu_usage=data.get('cpu_usage'),
            memory_total=data.get('memory_total'),
            memory_available=data.get('memory_available'),
            memory_used=data.get('memory_used'),
            memory_usage_percent=data.get('memory_usage_percent'),
            disk_total=data.get('disk_total'),
            disk_used=data.get('disk_used'),
            disk_free=data.get('disk_free'),
            disk_usage_percent=data.get('disk_usage_percent'),
            bytes_sent=data.get('bytes_sent'),
            bytes_received=data.get('bytes_received'),
            users_count=data.get('users_count'),
            logged_in_users=data.get('logged_in_users'),
        )
        return JsonResponse({'status': 'ok'})
    except (json.JSONDecodeError, ValueError) as e:
        return JsonResponse({'error': str(e)}, status=400)
