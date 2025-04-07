from django.urls import path
from dashboard import views  # Import your dashboard view

urlpatterns = [
    path('', views.dashboard_view, name='dashboard'),
   path("qr-scanner/", views.qr_scanner, name="qr_scanner"),
   path("scan-result/", views.scan_result, name="scan_result"),
   path("logout/", views.user_logout, name="logout"),
]