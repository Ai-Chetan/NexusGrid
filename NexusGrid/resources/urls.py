from django.urls import path
from resources import views

urlpatterns = [
   path('',views.resource_request,name='resource_request'),
]