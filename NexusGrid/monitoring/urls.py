from django.urls import path
from .views import SystemInfoAPIView

urlpatterns = [
    path('system-info/', SystemInfoAPIView.as_view(), name='system-info'),
]
