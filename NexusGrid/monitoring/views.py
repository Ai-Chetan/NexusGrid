import json
from datetime import timedelta
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from .models import SystemInfo, SystemCurrent
from system_layout.models import System


@login_required(login_url="/login/")
def system_status_api(request):
    """Return latest snapshots from the current-state table."""
    cutoff = timezone.now() - timedelta(seconds=90)
    SystemCurrent.objects.filter(
        last_seen_at__lt=cutoff,
        health_state=SystemCurrent.STATE_ONLINE,
    ).update(health_state=SystemCurrent.STATE_OFFLINE)
    SystemCurrent.objects.filter(
        last_seen_at__gte=cutoff,
    ).exclude(health_state=SystemCurrent.STATE_ONLINE).update(health_state=SystemCurrent.STATE_ONLINE)

    infos = [
        row.latest_info
        for row in SystemCurrent.objects.select_related('latest_info').order_by('hostname')
        if row.latest_info_id
    ]

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

        info = SystemInfo.objects.create(
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

        SystemCurrent.objects.update_or_create(
            hostname_key=hostname.lower(),
            defaults={
                'hostname': hostname,
                'latest_info': info,
                'last_seen_at': info.timestamp,
                'health_state': SystemCurrent.STATE_ONLINE,
            },
        )

        # Keep API v1 monitoring endpoint fresh after each ingest.
        from django.core.cache import cache
        cache.delete('monitoring_latest_v1')

        # Auto-mark the matching System as active so the layout shows green
        System.objects.filter(host_name__iexact=hostname).update(status='active')

        return JsonResponse({'status': 'ok'})
    except (json.JSONDecodeError, ValueError) as e:
        return JsonResponse({'error': str(e)}, status=400)
