from django.urls import path
from . import views

urlpatterns = [
    path('system-status/', views.system_status_api, name='monitoring_system_status'),
    path('ingest/', views.ingest_system_info, name='monitoring_ingest'),
    
    # Remote agent & installer API endpoints
    path('agent/script.py', views.download_script, name='monitoring_download_script'),
    path('agent/install/windows/', views.download_windows_installer, name='monitoring_download_windows'),
    path('agent/install/linux/', views.download_linux_installer, name='monitoring_download_linux'),
]

# http://127.0.0.1:8000/api/ingest/