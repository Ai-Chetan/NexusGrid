from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('api_v1.urls')),
    path('api/v1/rbac/', include('rbac.urls')),
    path('api/', include('monitoring.urls')),  # ingest endpoint for agents
]
