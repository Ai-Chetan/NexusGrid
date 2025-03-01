from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('',include('login_manager.urls')),
    path('login/',include('login_manager.urls'))
]