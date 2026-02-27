import socket
import platform
import psutil
import requests

# API URL
API_URL = "http://127.0.0.1:8000/api/ingest/"
# Function to fetch system information
def get_system_info():
    try:
        system_info = {
            "hostname": socket.gethostname(),
            "ip_address": socket.gethostbyname(socket.gethostname()),
            "os_name": platform.system(),
            "os_version": platform.version(),
            "cpu_usage": psutil.cpu_percent(interval=1),
            "ram_usage": psutil.virtual_memory().percent,
            "disk_usage": psutil.disk_usage('/').percent,
        }
        return system_info
    except Exception as e:
        print(f" Error fetching system info: {e}")
        return {}

# Function to send data to API
def send_data_to_api(system_info):
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.post(API_URL, json=system_info, headers=headers)
        print(f" Sent to API! Status: {response.status_code}, Response: {response.json()}")
    except Exception as e:
        print(f" Error sending data to API: {e}")

# Main function
if __name__ == "__main__":
    system_info = get_system_info()
    if system_info:
        send_data_to_api(system_info)  # Send data to API