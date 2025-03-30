from django.urls import path
from dashboard import views  # Import your dashboard view

urlpatterns = [
    path('', views.dashboard_view, name='dashboard'),
   path("logout/", views.user_logout, name="logout"),
]