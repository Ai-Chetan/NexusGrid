from django.urls import path
from .views import SystemInfoAPIView

urlpatterns = [
    path('system-info/', SystemInfoAPIView.as_view(), name='system_info'),  # ✅ Use `.as_view()`
]
