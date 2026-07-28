"""
Management command: run_agent
=============================
Collects local hardware/OS metrics and POSTs them to the NexusGrid
monitoring ingest endpoint. Replaces the old standalone script.py.

Usage
-----
    # Run once (useful for cron/Task Scheduler):
    python manage.py run_agent

    # Run in a loop with a configurable interval (seconds):
    python manage.py run_agent --interval 60

    # Target a specific ingest URL (overrides NEXUSGRID_INGEST_URL env var):
    python manage.py run_agent --url http://10.0.0.1:8000/api/ingest/

Environment variables
---------------------
    NEXUSGRID_INGEST_URL  - ingest endpoint (default: http://127.0.0.1:8000/api/ingest/)
    NEXUSGRID_AGENT_TOKEN - shared-secret sent as X-Agent-Token header (optional for now)
"""

import socket
import platform
import time
import os
import json
from datetime import datetime, timezone, timedelta


import psutil
import requests

from django.core.management.base import BaseCommand


DEFAULT_INGEST_URL = "https://nexusgrid.onrender.com/api/ingest/"



IST = timezone(timedelta(hours=5, minutes=30))
UPTIME_STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uptime_state.json")
DAILY_UPTIME_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "daily_uptime.json")
INACTIVITY_THRESHOLD = 2.5

def get_ist_now():
    return datetime.now(IST)

def _load_uptime_state():
    try:
        if os.path.exists(UPTIME_STATE_FILE):
            with open(UPTIME_STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return None

def _save_uptime_state(state):
    try:
        with open(UPTIME_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f)
    except Exception:
        pass

def _uptime_tick(interval=60):
    if interval <= 0: interval = 60
    now_dt = get_ist_now()
    now_ts = now_dt.timestamp()
    state = _load_uptime_state()
    if state is None:
        new_state = {"session_start_ts": now_ts, "run_count": 1, "last_run_ts": now_ts}
        _save_uptime_state(new_state)
        return now_ts, float(interval)
    session_start_ts = state.get("session_start_ts", now_ts)
    run_count = state.get("run_count", 0)
    last_run_ts = state.get("last_run_ts", now_ts)
    elapsed = now_ts - last_run_ts
    if elapsed > interval * INACTIVITY_THRESHOLD:
        session_start_ts = now_ts
        run_count = 1
    else:
        run_count += 1
    new_state = {"session_start_ts": session_start_ts, "run_count": run_count, "last_run_ts": now_ts}
    _save_uptime_state(new_state)
    return session_start_ts, round(run_count * interval, 2)

def _get_daily_uptime(interval=60):
    if interval <= 0: interval = 60
    try:
        now_dt = datetime.now()
        now_ts = now_dt.timestamp()
        today_date_str = now_dt.strftime("%Y-%m-%d")
        boot_time_ts = psutil.boot_time()
        current_uptime_seconds = int(now_ts - boot_time_ts)
        midnight_dt = now_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        midnight_ts = midnight_dt.timestamp()
        state = None
        if os.path.exists(DAILY_UPTIME_FILE):
            try:
                with open(DAILY_UPTIME_FILE, "r", encoding="utf-8") as f:
                    state = json.load(f)
            except Exception:
                pass
        if state is None:
            accumulated_uptime = now_ts - boot_time_ts if boot_time_ts >= midnight_ts else now_ts - midnight_ts
        else:
            saved_date = state.get("today_date", today_date_str)
            accumulated_uptime = state.get("today_uptime_seconds", 0.0)
            last_heartbeat_ts = state.get("last_heartbeat_timestamp", now_ts)
            last_boot_ts = state.get("last_boot_time", boot_time_ts)
            if saved_date != today_date_str:
                accumulated_uptime = 0.0
                if abs(last_boot_ts - boot_time_ts) < 5:
                    elapsed_total = now_ts - last_heartbeat_ts
                    if elapsed_total > 150: accumulated_uptime = float(interval)
                    else: accumulated_uptime = now_ts - midnight_ts
                else:
                    if boot_time_ts >= midnight_ts: accumulated_uptime = now_ts - boot_time_ts
                    else: accumulated_uptime = now_ts - midnight_ts
            else:
                if abs(last_boot_ts - boot_time_ts) < 5:
                    elapsed = now_ts - last_heartbeat_ts
                    if elapsed > 0:
                        if elapsed > 150: accumulated_uptime += float(interval)
                        else: accumulated_uptime += elapsed
                else:
                    elapsed_since_boot = now_ts - boot_time_ts
                    if elapsed_since_boot > 0: accumulated_uptime += elapsed_since_boot
        accumulated_uptime = max(0.0, accumulated_uptime)
        new_state = {"today_date": today_date_str, "today_uptime_seconds": accumulated_uptime, "last_heartbeat_timestamp": now_ts, "last_boot_time": boot_time_ts}
        try:
            with open(DAILY_UPTIME_FILE, "w", encoding="utf-8") as f:
                json.dump(new_state, f)
        except Exception:
            pass
        acc_sec = int(accumulated_uptime)
        formatted = f"{acc_sec // 3600:02d}:{(acc_sec % 3600) // 60:02d}:{acc_sec % 60:02d}"
        return current_uptime_seconds, acc_sec, formatted, today_date_str
    except Exception:
        return None, None, None, None

def collect_metrics(interval=60) -> dict:
    """Gather system hardware/OS metrics from the local machine."""
    try:
        hostname = socket.gethostname()
        ip_address = socket.gethostbyname(hostname)
    except OSError:
        hostname = "unknown"
        ip_address = None

    cpu_freq = psutil.cpu_freq()
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    net = psutil.net_io_counters()
    users = psutil.users()

    res = {
        "hostname": hostname,
        "ip_address": ip_address,
        "system": platform.system(),
        "version": platform.version(),
        "release": platform.release(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "architecture": platform.architecture()[0],
        "cpu_physical_cores": psutil.cpu_count(logical=False),
        "cpu_total_cores": psutil.cpu_count(logical=True),
        "cpu_max_freq": cpu_freq.max if cpu_freq else None,
        "cpu_min_freq": cpu_freq.min if cpu_freq else None,
        "cpu_current_freq": cpu_freq.current if cpu_freq else None,
        "cpu_usage": psutil.cpu_percent(interval=1),
        "memory_total": round(vm.total / (1024 ** 3), 2),
        "memory_available": round(vm.available / (1024 ** 3), 2),
        "memory_used": round(vm.used / (1024 ** 3), 2),
        "memory_usage_percent": vm.percent,
        "disk_total": round(disk.total / (1024 ** 3), 2),
        "disk_used": round(disk.used / (1024 ** 3), 2),
        "disk_free": round(disk.free / (1024 ** 3), 2),
        "disk_usage_percent": disk.percent,
        "bytes_sent": net.bytes_sent if net else None,
        "bytes_received": net.bytes_recv if net else None,
        "users_count": len(users),
        "logged_in_users": ", ".join(user.name for user in users),
    }
    try:
        boot_time_unix, uptime_secs = _uptime_tick(interval)
        res["boot_time"] = boot_time_unix
        res["uptime_seconds"] = uptime_secs
        cur_up_sec, today_up_sec, today_up_fmt, today_date = _get_daily_uptime(interval)
        if cur_up_sec is not None:
            res["current_uptime_seconds"] = cur_up_sec
            res["today_uptime_seconds"] = today_up_sec
            res["today_uptime_formatted"] = today_up_fmt
            res["today_date"] = today_date
    except Exception as e:
        import traceback
        traceback.print_exc()
        pass
    return res

def send_metrics(url: str, metrics: dict, token: str | None, logger) -> bool:
    """POST metrics to the ingest endpoint. Returns True on success."""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Agent-Token"] = token

    try:
        resp = requests.post(url, json=metrics, headers=headers, timeout=10)
        if resp.ok:
            logger.info("Metrics sent — status %s: %s", resp.status_code, resp.json())
            return True
        logger.warning("Ingest rejected — status %s: %s", resp.status_code, resp.text)
    except requests.RequestException as exc:
        logger.error("Failed to reach ingest endpoint: %s", exc)
    return False


class Command(BaseCommand):
    help = (
        "Collect local hardware/OS metrics and POST them to the NexusGrid "
        "monitoring ingest endpoint. Use --interval to run continuously."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval",
            type=int,
            default=0,
            metavar="SECONDS",
            help="If > 0, repeat every N seconds until interrupted (default: run once).",
        )
        parser.add_argument(
            "--url",
            default=os.getenv("NEXUSGRID_INGEST_URL", DEFAULT_INGEST_URL),
            metavar="URL",
            help=f"Ingest endpoint URL (default: {DEFAULT_INGEST_URL}).",
        )

    def handle(self, *args, **options):
        url: str = options["url"]
        interval: int = options["interval"]
        token: str | None = os.getenv("NEXUSGRID_AGENT_TOKEN")

        self.stdout.write(self.style.MIGRATE_HEADING(f"NexusGrid Agent → {url}"))
        if interval:
            self.stdout.write(f"  Polling every {interval}s. Press Ctrl+C to stop.\n")

        try:
            while True:
                metrics = collect_metrics(interval)
                self.stdout.write(f"  Hostname : {metrics['hostname']}")
                self.stdout.write(f"  CPU      : {metrics['cpu_usage']}%")
                self.stdout.write(f"  RAM      : {metrics['memory_usage_percent']}%")
                self.stdout.write(f"  Disk     : {metrics['disk_usage_percent']}%")

                success = send_metrics(url, metrics, token, self.stderr)
                if success:
                    self.stdout.write(self.style.SUCCESS("  ✓ Sent successfully.\n"))
                else:
                    self.stdout.write(self.style.ERROR("  ✗ Send failed — see errors above.\n"))

                if not interval:
                    break
                time.sleep(interval)

        except KeyboardInterrupt:
            self.stdout.write("\nAgent stopped.")
