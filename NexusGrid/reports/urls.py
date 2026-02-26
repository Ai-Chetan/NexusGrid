from django.urls import path
from . import views

urlpatterns = [
    path('', views.reports_view, name='reports'),
    path('api/', views.reports_api, name='reports_api'),
]
