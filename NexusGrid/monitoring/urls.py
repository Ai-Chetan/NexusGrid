from django.urls import path
from .views import system_monitor_view

urlpatterns = [
    path('', system_monitor_view, name='system_monitor'),
]
