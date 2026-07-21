import socket
import platform
import psutil
import requests
import os
from datetime import datetime

# Optional GPU support
try:
    import GPUtil
    GPUTIL_INSTALLED = True
except Exception:
    GPUTIL_INSTALLED = False

# Server Configuration - Easily switch between Local and Render Hosted backend
# Render Hosted URL: https://nexusgrid.onrender.com
# Local Server URL:  http://127.0.0.1:8000
DEFAULT_BASE_URL = os.getenv("NEXUSGRID_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
API_URL = os.getenv("NEXUSGRID_INGEST_URL", f"{DEFAULT_BASE_URL}/api/ingest/")



def get_primary_ip():
    """Resolve host IP without requiring external connectivity."""
    try:
        hostname = socket.gethostname()
        return socket.gethostbyname(hostname)
    except Exception:
        return None


def get_gpu_info():
    """Return (available, stats) and never raise on permission/tooling issues."""
    if not GPUTIL_INSTALLED:
        return False, None

    try:
        gpus = GPUtil.getGPUs()
        if not gpus:
            return False, []

        gpu_data = []
        for gpu in gpus:
            gpu_data.append({
                "gpu_id": gpu.id,
                "gpu_name": gpu.name,
                "gpu_load_percent": gpu.load * 100,
                "gpu_memory_used": gpu.memoryUsed,
                "gpu_memory_total": gpu.memoryTotal,
                "gpu_memory_percent": gpu.memoryUtil * 100,
                "gpu_temperature": gpu.temperature,
            })
        return True, gpu_data
    except Exception as e:
        # Common on Windows without admin/NVIDIA privileges.
        # Do not send parser errors in payload; just mark GPU unavailable.
        _ = e
        return False, None

def get_system_info():
    try:
        vm = psutil.virtual_memory()
        swap = psutil.swap_memory()
        disk_io = psutil.disk_io_counters()
        net_io = psutil.net_io_counters()
        cpu_freq = psutil.cpu_freq()
        disk_usage = psutil.disk_usage(os.path.abspath(os.sep))
        gpu_available, gpu_stats = get_gpu_info()

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
            "processor": platform.processor(),  # unit: text
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
            "memory_total": round(vm.total / (1024 ** 3), 2),  # unit: GB
            "memory_available": round(vm.available / (1024 ** 3), 2),  # unit: GB
            "memory_used": round(vm.used / (1024 ** 3), 2),  # unit: GB
            "memory_usage_percent": vm.percent,  # unit: percent (0-100)

            # Swap (important for AI)
            "swap_total": round(swap.total / (1024 ** 3), 2),  # unit: GB
            "swap_used": round(swap.used / (1024 ** 3), 2),  # unit: GB
            "swap_usage_percent": swap.percent,  # unit: percent (0-100)

            # Disk
            "disk_total": round(disk_usage.total / (1024 ** 3), 2),  # unit: GB
            "disk_used": round(disk_usage.used / (1024 ** 3), 2),  # unit: GB
            "disk_free": round(disk_usage.free / (1024 ** 3), 2),  # unit: GB
            "disk_usage_percent": disk_usage.percent,  # unit: percent (0-100)

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

            # Timestamp
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # unit: datetime string (YYYY-MM-DD HH:MM:SS)
        }

        return system_info

    except Exception as e:
        print(f"Error fetching system info: {e}")
        return {}

def send_data_to_api(system_info):
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.post(API_URL, json=system_info, headers=headers)
        print(f"Sent! Status: {response.status_code}")
    except Exception as e:
        print(f"Error sending data: {e}")

if __name__ == "__main__":
    system_info = get_system_info()
    if system_info:
        send_data_to_api(system_info)