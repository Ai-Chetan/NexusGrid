import socket
import platform
import psutil
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

#this part was for testing api 
#this thing is working properly but not for another pc .... working only for this pc

# def get_system_info():
#     try:
#         info = {
#             "hostname": socket.gethostname(),
#             "system": platform.system(),
#             "version": platform.version(),
#             "release": platform.release(),
#             "machine": platform.machine(),
#             "processor": platform.processor(),
#             "architecture": platform.architecture()[0],
#             "cpu_physical_cores": psutil.cpu_count(logical=False),
#             "cpu_total_cores": psutil.cpu_count(logical=True),
#             "cpu_max_freq": psutil.cpu_freq().max,
#             "cpu_min_freq": psutil.cpu_freq().min,
#             "cpu_current_freq": psutil.cpu_freq().current,
#             "cpu_usage": psutil.cpu_percent(interval=1),
#             "total_memory": round(psutil.virtual_memory().total / (1024 ** 3), 2),
#             "available_memory": round(psutil.virtual_memory().available / (1024 ** 3), 2),
#             "used_memory": round(psutil.virtual_memory().used / (1024 ** 3), 2),
#             "memory_usage": psutil.virtual_memory().percent,
#             "total_disk": round(psutil.disk_usage('/').total / (1024 ** 3), 2),
#             "used_disk": round(psutil.disk_usage('/').used / (1024 ** 3), 2),
#             "free_disk": round(psutil.disk_usage('/').free / (1024 ** 3), 2),
#             "disk_usage": psutil.disk_usage('/').percent,
#             "ip_address": socket.gethostbyname(socket.gethostname()),
#             "bytes_sent": psutil.net_io_counters().bytes_sent,
#             "bytes_received": psutil.net_io_counters().bytes_recv,
#             "current_users": len(psutil.users()),
#             "logged_in_users": [user.name for user in psutil.users()]
#         }
#         return info
#     except Exception as e:
#         return {"error": str(e)}

# class SystemInfoAPIView(APIView):
#     def get(self, request):
#         system_info = get_system_info()  # Fetch real-time system info
#         return Response(system_info, status=status.HTTP_200_OK)  # Return it as JSON
