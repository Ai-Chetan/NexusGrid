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

import psutil
import requests

from django.core.management.base import BaseCommand


DEFAULT_INGEST_URL = "http://127.0.0.1:8000/api/ingest/"


def collect_metrics() -> dict:
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

    return {
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
                metrics = collect_metrics()
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
