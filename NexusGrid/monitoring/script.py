import os
import sys
import time
import socket
import platform
import subprocess
import json
import psutil
import requests
from datetime import datetime, timezone, timedelta

# IST (India Standard Time) UTC+5:30 offset
IST = timezone(timedelta(hours=5, minutes=30))
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agent.log")

def get_ist_now():
    return datetime.now(IST)

def log_event(message):
    timestamp_str = get_ist_now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"{timestamp_str} {message}\n"
    print(log_line.strip())
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_line)
    except Exception:
        pass

# Server Configuration - Easily switch between Local and Render Hosted backend
# Render Hosted URL: https://nexusgrid.onrender.com
# Local Server URL:  http://127.0.0.1:8000
DEFAULT_BASE_URL = os.getenv("NEXUSGRID_BASE_URL", "https://nexusgrid.onrender.com").strip().rstrip("/")
API_URL = os.getenv("NEXUSGRID_INGEST_URL", f"{DEFAULT_BASE_URL}/api/ingest/").strip()


CREATE_NO_WINDOW = 0x08000000 if platform.system() == "Windows" else 0


def get_primary_ip():
    """Resolve host IP without requiring external connectivity."""
    try:
        hostname = socket.gethostname()
        return socket.gethostbyname(hostname)
    except Exception:
        return None


def get_gpu_info():
    """Return (available, stats) using native nvidia-smi / WMI query, avoiding broken GPUtil dependencies."""
    # 1. Try nvidia-smi (NVIDIA GPUs on Windows/Linux)
    try:
        cmd = [
            'nvidia-smi',
            '--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu',
            '--format=csv,noheader,nounits'
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=5, creationflags=CREATE_NO_WINDOW)
        if res.returncode == 0 and res.stdout.strip():
            gpu_data = []
            for line in res.stdout.strip().splitlines():
                parts = [p.strip() for p in line.split(',')]
                if len(parts) >= 6:
                    gpu_id = int(parts[0]) if parts[0].isdigit() else 0
                    gpu_name = parts[1]
                    gpu_load = float(parts[2]) if parts[2].replace('.', '', 1).isdigit() else 0.0
                    mem_used = float(parts[3]) if parts[3].replace('.', '', 1).isdigit() else 0.0
                    mem_total = float(parts[4]) if parts[4].replace('.', '', 1).isdigit() else 0.0
                    gpu_temp = float(parts[5]) if parts[5].replace('.', '', 1).isdigit() else None
                    mem_pct = (mem_used / mem_total * 100) if mem_total > 0 else 0.0
                    gpu_data.append({
                        "gpu_id": gpu_id,
                        "gpu_name": gpu_name,
                        "gpu_load_percent": gpu_load,
                        "gpu_memory_used": mem_used,
                        "gpu_memory_total": mem_total,
                        "gpu_memory_percent": round(mem_pct, 1),
                        "gpu_temperature": gpu_temp,
                    })
            if gpu_data:
                return True, gpu_data
    except Exception:
        pass

    # 2. Try Windows PowerShell WMI fallback for AMD / Intel / generic Windows GPUs
    if platform.system() == "Windows":
        try:
            ps_cmd = [
                'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
                'Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json'
            ]
            res = subprocess.run(ps_cmd, capture_output=True, text=True, timeout=8, creationflags=CREATE_NO_WINDOW)
            if res.returncode == 0 and res.stdout.strip():
                data = json.loads(res.stdout)
                if isinstance(data, dict):
                    data = [data]
                gpu_data = []
                for idx, item in enumerate(data):
                    name = item.get('Name') or ''
                    if name and 'microsoft' not in name.lower() and 'basic render' not in name.lower():
                        ram_bytes = item.get('AdapterRAM') or 0
                        ram_mb = round(ram_bytes / (1024 * 1024), 2) if ram_bytes > 0 else 0
                        gpu_data.append({
                            "gpu_id": idx,
                            "gpu_name": name,
                            "gpu_load_percent": 0.0,
                            "gpu_memory_used": 0.0,
                            "gpu_memory_total": ram_mb,
                            "gpu_memory_percent": 0.0,
                            "gpu_temperature": None,
                        })
                if gpu_data:
                    return True, gpu_data
        except Exception:
            pass

    return False, None

def get_processor_name():
    """Return human-readable CPU brand name instead of raw architecture family string."""
    sys_type = platform.system()
    if sys_type == 'Windows':
        try:
            import winreg
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'HARDWARE\DESCRIPTION\System\CentralProcessor\0')
            name, _ = winreg.QueryValueEx(key, 'ProcessorNameString')
            if name and name.strip():
                return name.strip()
        except Exception:
            pass
    elif sys_type == 'Linux':
        try:
            with open('/proc/cpuinfo', 'r') as f:
                for line in f:
                    if 'model name' in line:
                        return line.split(':', 1)[1].strip()
        except Exception:
            pass
    elif sys_type == 'Darwin':
        try:
            return subprocess.check_output(['sysctl', '-n', 'machdep.cpu.brand_string'], text=True, creationflags=CREATE_NO_WINDOW).strip()
        except Exception:
            pass
    return platform.processor() or 'Unknown Processor'


def get_total_disk_info():
    """Aggregate storage across all mounted local physical/fixed drives instead of single mountpoint."""
    total, used, free = 0, 0, 0
    seen_devs = set()
    for p in psutil.disk_partitions(all=False):
        if 'cdrom' in p.opts or not p.fstype or p.device in seen_devs:
            continue
        try:
            u = psutil.disk_usage(p.mountpoint)
            total += u.total
            used += u.used
            free += u.free
            seen_devs.add(p.device)
        except Exception:
            continue
    if total == 0:
        try:
            u = psutil.disk_usage(os.path.abspath(os.sep))
            total, used, free = u.total, u.used, u.free
        except Exception:
            pass
    pct = round((used / total) * 100, 1) if total > 0 else 0.0
    return {
        "disk_total": round(total / (1024 ** 3), 2),
        "disk_used": round(used / (1024 ** 3), 2),
        "disk_free": round(free / (1024 ** 3), 2),
        "disk_usage_percent": pct,
    }


def get_system_info():
    try:
        vm = psutil.virtual_memory()
        swap = psutil.swap_memory()
        disk_io = psutil.disk_io_counters() or type('IO', (), {'read_bytes': 0, 'write_bytes': 0})()
        net_io = psutil.net_io_counters() or type('NET', (), {'bytes_sent': 0, 'bytes_recv': 0})()
        cpu_freq = psutil.cpu_freq()
        disk_info = get_total_disk_info()
        processor_name = get_processor_name()
        gpu_available, gpu_stats = get_gpu_info()

        # Accurately compute memory metrics matching OS Task Manager
        mem_total = round(vm.total / (1024 ** 3), 2)
        mem_avail = round(vm.available / (1024 ** 3), 2)
        mem_used = round((vm.total - vm.available) / (1024 ** 3), 2)
        mem_pct = round(((vm.total - vm.available) / vm.total) * 100, 1) if vm.total > 0 else 0.0

        try:
            cpu_load_avg = list(os.getloadavg()) if hasattr(os, "getloadavg") else None
        except Exception:
            cpu_load_avg = None

        # Top processes (by CPU)
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                processes.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        top_processes = sorted(processes, key=lambda x: x['cpu_percent'], reverse=True)[:5]

        logged_in_users = [u.name for u in psutil.users()]

        system_info = {
            # Basic system info
            "hostname": socket.gethostname(),  # unit: text
            "ip_address": get_primary_ip(),  # unit: IPv4/IPv6 string
            "system": platform.system(),  # unit: text
            "version": platform.version(),  # unit: text
            "release": platform.release(),  # unit: text
            "machine": platform.machine(),  # unit: text
            "processor": processor_name,  # unit: text (brand name e.g., 12th Gen Intel Core i5-12450H)
            "architecture": platform.architecture()[0],  # unit: text (e.g., 64bit)

            # CPU
            "cpu_physical_cores": psutil.cpu_count(logical=False),  # unit: count
            "cpu_total_cores": psutil.cpu_count(logical=True),  # unit: count
            "cpu_max_freq": cpu_freq.max if cpu_freq else None,  # unit: MHz
            "cpu_min_freq": cpu_freq.min if cpu_freq else None,  # unit: MHz
            "cpu_current_freq": cpu_freq.current if cpu_freq else None,  # unit: MHz
            "cpu_usage": psutil.cpu_percent(interval=1),  # unit: percent (0-100)
            "cpu_load_avg": cpu_load_avg,  # unit: load average (1m, 5m, 15m)

            # Memory
            "memory_total": mem_total,  # unit: GB
            "memory_available": mem_avail,  # unit: GB
            "memory_used": mem_used,  # unit: GB
            "memory_usage_percent": mem_pct,  # unit: percent (0-100)

            # Swap (important for AI)
            "swap_total": round(swap.total / (1024 ** 3), 2),  # unit: GB
            "swap_used": round(swap.used / (1024 ** 3), 2),  # unit: GB
            "swap_usage_percent": swap.percent,  # unit: percent (0-100)

            # Disk (Aggregated across all physical drives C:, D:, etc.)
            "disk_total": disk_info["disk_total"],  # unit: GB
            "disk_used": disk_info["disk_used"],  # unit: GB
            "disk_free": disk_info["disk_free"],  # unit: GB
            "disk_usage_percent": disk_info["disk_usage_percent"],  # unit: percent (0-100)

            # Disk I/O (AI workloads heavy here)
            "disk_read_bytes": disk_io.read_bytes,  # unit: bytes
            "disk_write_bytes": disk_io.write_bytes,  # unit: bytes

            # Network
            "bytes_sent": net_io.bytes_sent,  # unit: bytes
            "bytes_received": net_io.bytes_recv,  # unit: bytes

            # Process insights (AI processes detection)
            "top_processes": top_processes,  # unit: list of process objects

            # GPU metrics (if available)
            "gpu_available": gpu_available,  # unit: boolean
            "gpu_stats": gpu_stats,  # unit: list/dict (GPU metrics)

            # Users
            "users_count": len(logged_in_users),  # unit: count
            "logged_in_users": ", ".join(logged_in_users),  # unit: comma-separated usernames

            # Uptime – populated by the main loop via _uptime_tick() (counter-based)
            "boot_time": None,  # unit: unix timestamp – set by caller
            "uptime_seconds": None,  # unit: seconds – set by caller

            # Timestamp (IST)
            "timestamp": get_ist_now().strftime("%Y-%m-%d %H:%M:%S")  # unit: datetime string in IST (YYYY-MM-DD HH:MM:SS)
        }

        return system_info

    except Exception as e:
        log_event(f"[ERROR] Error fetching system info: {e}")
        return {}

def send_data_to_api(system_info):
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.post(API_URL, json=system_info, headers=headers, timeout=10)
        gpu_str = "Active" if system_info.get("gpu_available") else "None"
        cpu_val = system_info.get("cpu_usage", 0)
        ram_val = system_info.get("memory_usage_percent", 0)
        host_val = system_info.get("hostname", "Unknown")

        log_event(
            f"[INFO] Sent telemetry to {API_URL} | Status: {response.status_code} | "
            f"Host: {host_val} | CPU: {cpu_val}% | RAM: {ram_val}% | GPU: {gpu_str}"
        )
    except Exception as e:
        log_event(f"[ERROR] Error sending data to {API_URL}: {e}")

def send_offline_signal():
    """Send immediate offline state signal to backend API on shutdown/logoff."""
    try:
        url = f"{DEFAULT_BASE_URL}/api/offline/"
        hostname = socket.gethostname()
        requests.post(url, json={"hostname": hostname}, timeout=3)
        log_event(f"[INFO] Sent shutdown offline signal to {url} for host {hostname}")
    except Exception as e:
        log_event(f"[ERROR] Error sending offline signal to {DEFAULT_BASE_URL}: {e}")

# Register Windows console control handler for shutdown/logoff events
if platform.system() == "Windows":
    try:
        import ctypes
        from ctypes import wintypes

        PHANDLER_ROUTINE = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.DWORD)

        def _console_ctrl_handler(ctrl_type):
            if ctrl_type in (2, 5, 6):  # CTRL_CLOSE_EVENT, CTRL_LOGOFF_EVENT, CTRL_SHUTDOWN_EVENT
                log_event(f"[INFO] Detected system shutdown/logoff (event {ctrl_type}). Marking offline...")
                send_offline_signal()
                return True
            return False

        _global_ctrl_handler = PHANDLER_ROUTINE(_console_ctrl_handler)
        ctypes.windll.kernel32.SetConsoleCtrlHandler(_global_ctrl_handler, True)
    except Exception as e:
        log_event(f"[WARNING] Could not register Windows console ctrl handler: {e}")

import sys
import time

# ── Uptime tracking (counter-based, persisted to disk) ────────────────────────
SLEEP_INTERVAL = 60  # seconds between each reporting cycle
INACTIVITY_THRESHOLD = 2.5  # if gap between runs exceeds this × SLEEP_INTERVAL, assume system was inactive

UPTIME_STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uptime_state.json")


def _load_uptime_state():
    """Load persisted uptime state from disk. Returns dict or None."""
    try:
        if os.path.exists(UPTIME_STATE_FILE):
            with open(UPTIME_STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return None


def _save_uptime_state(state):
    """Persist uptime state to disk so it survives process restarts."""
    try:
        with open(UPTIME_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f)
    except Exception:
        pass


def _uptime_tick():
    """Call once per loop iteration. Returns (boot_time_unix, uptime_seconds).

    Persists state to a JSON file so the counter survives across separate
    process invocations (e.g. when launched via `script.py --once` from a
    VBS wrapper every 60 seconds).

    Detects system inactivity (sleep / hibernate) by comparing the real
    elapsed time since the last tick against the expected SLEEP_INTERVAL.
    When a gap is detected the counter resets so uptime reflects only
    *active* monitoring time.
    """
    now_dt = get_ist_now()
    now_ts = now_dt.timestamp()
    state = _load_uptime_state()

    if state is None:
        # First ever run – start a fresh session
        new_state = {
            "session_start_ts": now_ts,
            "run_count": 1,
            "last_run_ts": now_ts,
        }
        _save_uptime_state(new_state)
        return now_ts, float(SLEEP_INTERVAL)

    session_start_ts = state.get("session_start_ts", now_ts)
    run_count = state.get("run_count", 0)
    last_run_ts = state.get("last_run_ts", now_ts)

    elapsed = now_ts - last_run_ts

    if elapsed > SLEEP_INTERVAL * INACTIVITY_THRESHOLD:
        # System was likely sleeping / hibernating – reset session
        log_event(
            f"[INFO] Inactivity detected (gap {elapsed:.0f}s > threshold "
            f"{SLEEP_INTERVAL * INACTIVITY_THRESHOLD:.0f}s). Resetting uptime counter."
        )
        session_start_ts = now_ts
        run_count = 1
    else:
        run_count += 1

    new_state = {
        "session_start_ts": session_start_ts,
        "run_count": run_count,
        "last_run_ts": now_ts,
    }
    _save_uptime_state(new_state)

    uptime_seconds = round(run_count * SLEEP_INTERVAL, 2)
    return session_start_ts, uptime_seconds


if __name__ == "__main__":
    run_once = "--once" in sys.argv
    while True:
        try:
            boot_time_unix, uptime_secs = _uptime_tick()
            system_info = get_system_info()
            if system_info:
                # Override the old psutil-based uptime with counter-based values
                system_info["boot_time"] = boot_time_unix
                system_info["uptime_seconds"] = uptime_secs
                send_data_to_api(system_info)
        except Exception as e:
            pass
        if run_once:
            break
        time.sleep(SLEEP_INTERVAL)






































































