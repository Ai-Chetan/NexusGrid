import json
from datetime import timedelta
from django.conf import settings
from django.http import JsonResponse, HttpResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from django.db.models import Q
from .models import SystemInfo, SystemCurrent
from system_layout.models import System, LayoutItem, SYSTEM_TYPES


def _online_cutoff():
    """Return the datetime before which a host is considered offline.
    Threshold is controlled by MONITORING_ONLINE_THRESHOLD_MINUTES in settings.
    """
    minutes = getattr(settings, 'MONITORING_ONLINE_THRESHOLD_MINUTES', 2)
    return timezone.now() - timedelta(minutes=minutes)


def sync_host_health_states():
    """Evaluate heartbeat staleness for all hosts and sync health_state + System status."""
    cutoff = _online_cutoff()
    
    # Mark systems offline
    offline_hostnames = list(SystemCurrent.objects.filter(
        last_seen_at__lt=cutoff,
        health_state=SystemCurrent.STATE_ONLINE,
    ).values_list('hostname', flat=True))
    
    if offline_hostnames:
        SystemCurrent.objects.filter(
            last_seen_at__lt=cutoff,
            health_state=SystemCurrent.STATE_ONLINE,
        ).update(health_state=SystemCurrent.STATE_OFFLINE)
        
        System.objects.filter(
            Q(host_name__in=offline_hostnames) | Q(layout_item__name__in=offline_hostnames)
        ).update(status='inactive')
        
    # Mark systems online
    online_hostnames = list(SystemCurrent.objects.filter(
        last_seen_at__gte=cutoff,
    ).exclude(health_state=SystemCurrent.STATE_ONLINE).values_list('hostname', flat=True))
    
    if online_hostnames:
        SystemCurrent.objects.filter(
            last_seen_at__gte=cutoff,
        ).exclude(health_state=SystemCurrent.STATE_ONLINE).update(health_state=SystemCurrent.STATE_ONLINE)
        
        System.objects.filter(
            Q(host_name__in=online_hostnames) | Q(layout_item__name__in=online_hostnames)
        ).update(status='active')


@login_required(login_url="/login/")
def system_status_api(request):
    """Return latest snapshots from the current-state table."""
    sync_host_health_states()


    # Build a map of hostname_key → health_state for fast lookup
    current_rows = {
        row.hostname_key: row
        for row in SystemCurrent.objects.select_related('latest_info').order_by('hostname')
    }

    data = [
        {
            # ── Online/offline status (canonical field) ──────────────────────
            'health_state': row.health_state,
            # ── Snapshot metrics ─────────────────────────────────────────────
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
            'cpu_load_avg': info.cpu_load_avg,
            'memory_total': info.memory_total,
            'memory_available': info.memory_available,
            'memory_used': info.memory_used,
            'memory_usage_percent': info.memory_usage_percent,
            'swap_total': info.swap_total,
            'swap_used': info.swap_used,
            'swap_usage_percent': info.swap_usage_percent,
            'disk_total': info.disk_total,
            'disk_used': info.disk_used,
            'disk_free': info.disk_free,
            'disk_usage_percent': info.disk_usage_percent,
            'disk_read_bytes': info.disk_read_bytes,
            'disk_write_bytes': info.disk_write_bytes,
            'bytes_sent': info.bytes_sent,
            'bytes_received': info.bytes_received,
            'top_processes': info.top_processes,
            'users_count': info.users_count,
            'logged_in_users': info.logged_in_users,
            'gpu_available': info.gpu_available,
            'gpu_stats': info.gpu_stats,
            'boot_time': info.boot_time,
            'uptime_seconds': info.uptime_seconds,
            'today_uptime_seconds': info.today_uptime_seconds,
            'today_uptime_formatted': info.today_uptime_formatted,
            'today_date': info.today_date,
            'timestamp': info.timestamp.isoformat(),
        }
        for row in current_rows.values()
        if row.latest_info_id and (info := row.latest_info) is not None
    ]
    return JsonResponse({'systems': data})


@csrf_exempt
@require_POST
def ingest_system_info(request):
    """Agent endpoint: receives hardware metrics POSTed by a monitored machine."""
    try:
        data = json.loads(request.body)

        def as_int(value):
            try:
                if value in (None, ''):
                    return None
                return int(value)
            except (TypeError, ValueError):
                return None

        def as_float(value):
            try:
                if value in (None, ''):
                    return None
                return float(value)
            except (TypeError, ValueError):
                return None

        def as_bool(value):
            if isinstance(value, bool):
                return value
            if value in (None, ''):
                return None
            text = str(value).strip().lower()
            if text in ('1', 'true', 'yes', 'y', 'on'):
                return True
            if text in ('0', 'false', 'no', 'n', 'off'):
                return False
            return None

        hostname = data.get('hostname', '').strip()
        if not hostname:
            return JsonResponse({'error': 'hostname is required'}, status=400)
            
        boot_time = as_float(data.get('boot_time'))
        today_uptime_seconds = as_float(data.get('today_uptime_seconds'))
        today_uptime_formatted = data.get('today_uptime_formatted')
        today_date = data.get('today_date')
        
        # Calculate cumulative daily active uptime across all boot sessions recorded today
        from collections import defaultdict
        from django.utils import timezone
        now_dt = timezone.localtime()
        today_date_str = now_dt.strftime('%Y-%m-%d')
        midnight_dt = now_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        midnight_ts = midnight_dt.timestamp()
        now_ts = now_dt.timestamp()

        today_snaps = list(
            SystemInfo.objects.filter(
                hostname__iexact=hostname,
                timestamp__gte=midnight_dt,
                boot_time__isnull=False
            ).values('boot_time', 'timestamp')
        )

        sessions = defaultdict(list)
        for s in today_snaps:
            sessions[s['boot_time']].append(s['timestamp'].timestamp())

        if boot_time is not None:
            sessions[boot_time].append(now_ts)

        computed_today_uptime = 0.0
        for b_time, timestamps in sessions.items():
            max_seen = max(timestamps)
            if b_time >= midnight_ts:
                computed_today_uptime += max(0.0, max_seen - b_time)
            else:
                computed_today_uptime += max(0.0, max_seen - midnight_ts)

        if today_uptime_seconds is not None:
            today_uptime_seconds = max(today_uptime_seconds, computed_today_uptime)
        else:
            today_uptime_seconds = computed_today_uptime

        today_date = today_date or today_date_str
        acc_sec = int(today_uptime_seconds)
        h = acc_sec // 3600
        m = (acc_sec % 3600) // 60
        s = acc_sec % 60
        today_uptime_formatted = f"{h:02d}:{m:02d}:{s:02d}"

        info = SystemInfo.objects.create(
            hostname=hostname,
            ip_address=data.get('ip_address'),
            system=data.get('system'),
            version=data.get('version'),
            release=data.get('release'),
            machine=data.get('machine'),
            processor=data.get('processor'),
            architecture=data.get('architecture'),
            cpu_physical_cores=as_int(data.get('cpu_physical_cores')),
            cpu_total_cores=as_int(data.get('cpu_total_cores')),
            cpu_max_freq=as_float(data.get('cpu_max_freq')),
            cpu_min_freq=as_float(data.get('cpu_min_freq')),
            cpu_current_freq=as_float(data.get('cpu_current_freq')),
            cpu_usage=as_float(data.get('cpu_usage')),
            cpu_load_avg=data.get('cpu_load_avg'),
            memory_total=as_float(data.get('memory_total')),
            memory_available=as_float(data.get('memory_available')),
            memory_used=as_float(data.get('memory_used')),
            memory_usage_percent=as_float(data.get('memory_usage_percent')),
            swap_total=as_float(data.get('swap_total')),
            swap_used=as_float(data.get('swap_used')),
            swap_usage_percent=as_float(data.get('swap_usage_percent')),
            disk_total=as_float(data.get('disk_total')),
            disk_used=as_float(data.get('disk_used')),
            disk_free=as_float(data.get('disk_free')),
            disk_usage_percent=as_float(data.get('disk_usage_percent')),
            disk_read_bytes=as_int(data.get('disk_read_bytes')),
            disk_write_bytes=as_int(data.get('disk_write_bytes')),
            bytes_sent=as_int(data.get('bytes_sent')),
            bytes_received=as_int(data.get('bytes_received')),
            top_processes=data.get('top_processes'),
            users_count=as_int(data.get('users_count')),
            logged_in_users=data.get('logged_in_users'),
            gpu_available=as_bool(data.get('gpu_available')),
            gpu_stats=data.get('gpu_stats'),
            boot_time=boot_time,
            uptime_seconds=as_float(data.get('uptime_seconds')),
            today_uptime_seconds=today_uptime_seconds,
            today_uptime_formatted=today_uptime_formatted,
            today_date=today_date,
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
        System.objects.filter(
            Q(host_name__iexact=hostname) | Q(layout_item__name__iexact=hostname)
        ).update(status='active')

        # Link or create System object for matching LayoutItem if unlinked
        unlinked_items = LayoutItem.objects.filter(name__iexact=hostname, item_type__in=SYSTEM_TYPES, system__isnull=True)
        for li in unlinked_items:
            System.objects.create(
                layout_item=li,
                host_name=li.name,
                status='active',
                updated_at=timezone.now()
            )

        # ── Auto-sweep stale hosts (configurable threshold) ────────────────
        stale_cutoff = info.timestamp - timedelta(minutes=getattr(settings, 'MONITORING_ONLINE_THRESHOLD_MINUTES', 2))
        stale_hostnames = list(
            SystemCurrent.objects
            .filter(last_seen_at__lt=stale_cutoff, health_state=SystemCurrent.STATE_ONLINE)
            .exclude(hostname_key=hostname.lower())
            .values_list('hostname', flat=True)
        )
        if stale_hostnames:
            SystemCurrent.objects.filter(
                last_seen_at__lt=stale_cutoff,
                health_state=SystemCurrent.STATE_ONLINE,
            ).exclude(hostname_key=hostname.lower()).update(health_state=SystemCurrent.STATE_OFFLINE)
            System.objects.filter(
                Q(host_name__in=stale_hostnames) | Q(layout_item__name__in=stale_hostnames)
            ).update(status='inactive')

        return JsonResponse({'status': 'ok'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
@require_POST
def mark_system_offline(request):
    """Shutdown hook: immediately marks a machine as offline/inactive.

    Called by send_offline.bat when the PC shuts down or logs off.
    Expects JSON body: {"hostname": "<machine-hostname>"}
    """
    try:
        data = json.loads(request.body)
        hostname = (data.get('hostname') or '').strip()
        if not hostname:
            return JsonResponse({'error': 'hostname is required'}, status=400)

        hostname_key = hostname.lower()

        updated = SystemCurrent.objects.filter(hostname_key=hostname_key).update(
            health_state=SystemCurrent.STATE_OFFLINE,
        )

        # Mark the System layout entry as inactive immediately (grey color)
        System.objects.filter(
            Q(host_name__iexact=hostname) | Q(layout_item__name__iexact=hostname)
        ).update(status='inactive')

        # Invalidate monitoring cache so UI reflects new state immediately
        from django.core.cache import cache
        cache.delete('monitoring_latest_v1')

        return JsonResponse({
            'status': 'ok',
            'hostname': hostname,
            'marked_offline': True,
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


def download_script(request):
    """Serve monitoring script API info or raw script for auto-updating."""
    import os
    file_path = os.path.join(os.path.dirname(__file__), 'script.py')
    if not os.path.exists(file_path):
        return JsonResponse({'error': 'script.py not found'}, status=404)

    is_raw = request.GET.get('format') == 'raw' or any(
        ua in (request.META.get('HTTP_USER_AGENT') or '').lower()
        for ua in ['python', 'curl', 'wget', 'powershell']
    )

    with open(file_path, 'r', encoding='utf-8-sig') as f:
        content = f.read().lstrip('\ufeff')

    if is_raw:
        return HttpResponse(content, content_type='text/plain; charset=utf-8')

    base_url = request.build_absolute_uri('/')[:-1]
    return JsonResponse({
        'status': 'success',
        'agent_name': 'NexusGrid Monitoring Agent',
        'filename': 'script.py',
        'backend_server': base_url,
        'ingest_url': f"{base_url}/api/ingest/",
        'raw_download_url': f"{base_url}/api/agent/script.py?format=raw",
        'supported_platforms': ['Windows', 'Linux'],
    }, json_dumps_params={'indent': 2})


def download_windows_installer(request):
    """API endpoint for Windows monitoring agent details & installer."""
    import os
    file_path = os.path.join(os.path.dirname(__file__), 'install_monitoring.bat')
    if not os.path.exists(file_path):
        return JsonResponse({'error': 'install_monitoring.bat not found'}, status=404)

    if request.GET.get('format') == 'raw':
        with open(file_path, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/plain; charset=utf-8')

    base_url = request.build_absolute_uri('/')[:-1]
    return JsonResponse({
        'status': 'success',
        'os': 'Windows',
        'backend_server': base_url,
        'ingest_url': f"{base_url}/api/ingest/",
        'script_url': f"{base_url}/api/agent/script.py",
        'raw_download_url': f"{base_url}/api/agent/install/windows/?format=raw",
        'installer_filename': 'install_monitoring.bat',
        'install_command': 'cmd /c install_monitoring.bat',
        'auto_start_mechanism': 'Windows Task Scheduler & Startup Folder',
        'instructions': 'Run install_monitoring.bat in Command Prompt on Windows client.'
    }, json_dumps_params={'indent': 2})


def download_linux_installer(request):
    """API endpoint for Linux monitoring agent details & installer."""
    import os
    file_path = os.path.join(os.path.dirname(__file__), 'install_monitoring.sh')
    if not os.path.exists(file_path):
        return JsonResponse({'error': 'install_monitoring.sh not found'}, status=404)

    if request.GET.get('format') == 'raw':
        with open(file_path, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/plain; charset=utf-8')

    base_url = request.build_absolute_uri('/')[:-1]
    return JsonResponse({
        'status': 'success',
        'os': 'Linux',
        'backend_server': base_url,
        'ingest_url': f"{base_url}/api/ingest/",
        'script_url': f"{base_url}/api/agent/script.py",
        'raw_download_url': f"{base_url}/api/agent/install/linux/?format=raw",
        'installer_filename': 'install_monitoring.sh',
        'install_command': 'chmod +x install_monitoring.sh && ./install_monitoring.sh',
        'auto_start_mechanism': 'Systemd Service & User Crontab @reboot',
        'instructions': 'Run chmod +x install_monitoring.sh && ./install_monitoring.sh on Linux client.'
    }, json_dumps_params={'indent': 2})


