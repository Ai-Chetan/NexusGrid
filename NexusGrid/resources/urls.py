from django.urls import path
from resources import views

urlpatterns = [
   path('',views.resource_requests,name='resource_request'), 
   path('update-resource-status/<int:resource_id>/', views.update_resource_status, name='update_resource_status'),
]