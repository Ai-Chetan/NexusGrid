from django.urls import path
from resources import views

urlpatterns = [
    path('', views.resource_requests, name='resource_requests'),
    path('update-resource-status/<int:resource_id>/', views.update_resource_status, name='update_resource_status'),
    path('systems-autocomplete/', views.get_systems_autocomplete, name='resources_systems_autocomplete'),
    path('labs-autocomplete/', views.get_labs_autocomplete, name='resources_labs_autocomplete'),
    path('create/', views.create_resource_request, name='create_resource_request'),
]