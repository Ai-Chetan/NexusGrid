
from django.contrib import admin
from django.urls import path
from NexusGrid import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.home, name='home'),
    path('Login', views.login, name='login'),
    path('Admin_Dashboard', views.admin_dashboard, name='admin_dashboard'),
    path('Supervisor_Dashboard', views.supervisor_dashboard, name='supervisor_dashboard'),
    path('User_Dashboard', views.user_dashboard, name='user_dashboard')
]
