from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),  # Admin Panel
    path('', include('login_manager.urls')),  # Login Manager (handles login & root page)
    path('dashboard/', include('dashboard.urls')),  # Dashboard app
    path('accounts/', include('allauth.urls')),  # Allauth
    # path('layout/', include('system_layout.urls')),  # System Layout app
    path('layout/', include(('system_layout.urls', 'system_layout'), namespace='layout')),
]
