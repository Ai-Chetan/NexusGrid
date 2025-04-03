import socket
import platform
import psutil
import requests
import json
import time
import socketio

# Socket.IO Client Setup
sio = socketio.Client()

# API URLs
API_URLS = [
    "http://127.0.0.1:8000/api/system-info/",
    "http://nexusgrid.onrender.com/api/system-info/"
]

# Socket.IO Server URL (Replace with your admin PC IP)
SOCKET_IO_SERVER = "http://admin_pc_ip:5000"

def get_system_info():
    """Fetches system info and returns as a dictionary."""
    try:
        info = {
            "hostname": socket.gethostname(),
            "system": platform.system(),
            "version": platform.version(),
            "release": platform.release(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "architecture": platform.architecture()[0],

            "cpu": {
                "physical_cores": psutil.cpu_count(logical=False),
                "total_cores": psutil.cpu_count(logical=True),
                "max_freq": psutil.cpu_freq().max,
                "min_freq": psutil.cpu_freq().min,
                "current_freq": psutil.cpu_freq().current,
                "cpu_usage": psutil.cpu_percent(interval=1)
            },

            "memory": {
                "total": round(psutil.virtual_memory().total / (1024 ** 3), 2),
                "available": round(psutil.virtual_memory().available / (1024 ** 3), 2),
                "used": round(psutil.virtual_memory().used / (1024 ** 3), 2),
                "usage_percent": psutil.virtual_memory().percent
            },

            "disk": {
                "total": round(psutil.disk_usage('/').total / (1024 ** 3), 2),
                "used": round(psutil.disk_usage('/').used / (1024 ** 3), 2),
                "free": round(psutil.disk_usage('/').free / (1024 ** 3), 2),
                "usage_percent": psutil.disk_usage('/').percent
            },

            "network": {
                "ip_address": socket.gethostbyname(socket.gethostname()),
                "bytes_sent": psutil.net_io_counters().bytes_sent,
                "bytes_received": psutil.net_io_counters().bytes_recv
            },

            "users": {
                "current_users": len(psutil.users()),
                "logged_in_users": [user.name for user in psutil.users()]
            }
        }
        return info
    except Exception as e:
        print(f"Error fetching system info: {e}")
        return {}

def send_data_to_api(data):
    """Sends system data to the API endpoints."""
    for url in API_URLS:
        try:
            response = requests.post(url, json=data, timeout=5)
            if response.status_code == 201:
                print(f"✅ Data successfully sent to {url}")
            else:
                print(f"⚠️ Failed to send data to {url}: {response.status_code} - {response.text}")
        except requests.exceptions.RequestException as e:
            print(f"❌ Error sending data to {url}: {e}")

def send_data_to_socket(data):
    """Sends system info to the admin PC via Socket.IO."""
    try:
        sio.emit('system_info', data)
        print("📡 Data sent to admin PC via Socket.IO")
    except Exception as e:
        print(f"⚠️ Socket.IO error: {e}")

def main():
    """Main loop to fetch system info and send it periodically."""
    print(" Starting system monitoring script...")
    
    # Connect to Socket.IO server
    try:
        sio.connect(SOCKET_IO_SERVER)
        print("✅ Connected to Socket.IO server")
    except Exception as e:
        print(f"⚠️ Could not connect to Socket.IO server: {e}")

    while True:
        system_info = get_system_info()
        if system_info:
            send_data_to_api(system_info)
            send_data_to_socket(system_info)

        time.sleep(300)  # Run every 5 minutes

if __name__ == "__main__":
    main()
