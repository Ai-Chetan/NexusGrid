from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('api_v1.urls')),
    path('', include('login_manager.urls')),
    path('dashboard/', include('dashboard.urls')),
    path('accounts/', include('allauth.urls')),
    path('layout/', include('system_layout.urls')),
    path('faults/', include('faults.urls')),
    path('resources/', include('resources.urls')),
    path('reports/', include('reports.urls')),
    path("api/", include("monitoring.urls")),
    path("userprivileges/", include("userprivileges.urls")),
]
