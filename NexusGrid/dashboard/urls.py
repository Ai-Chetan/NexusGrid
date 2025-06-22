from django.urls import path
from dashboard import views  # Import your dashboard view

urlpatterns = [
    path('', views.dashboard_view, name='dashboard'),
    path('api/', views.dashboard_api, name='dashboard_api'),
    path("qr-scanner/", views.qr_scanner_view, name="qr_scanner_view"),
    path("scan-result/", views.process_qr_scan, name="process_qr_scan"),
    path("logout/", views.user_logout, name="logout"),
]