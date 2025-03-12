from django.urls import path
from .views import dashboard_view  # Import your dashboard view

urlpatterns = [
    path('', dashboard_view, name='dashboard'),  # Dashboard homepage
]
