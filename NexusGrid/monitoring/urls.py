from django.urls import path
from .views import system_info_view

urlpatterns = [
    path('system-info/', system_info_view, name='system-info'),
]

