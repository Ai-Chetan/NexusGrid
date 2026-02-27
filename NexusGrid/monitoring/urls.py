from django.urls import path
from . import views

urlpatterns = [
    path('system-status/', views.system_status_api, name='monitoring_system_status'),
    path('ingest/', views.ingest_system_info, name='monitoring_ingest'),
]
# http://127.0.0.1:8000/api/ingest/