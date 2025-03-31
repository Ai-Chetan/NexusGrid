from django.urls import path
from faults import views

urlpatterns = [
   path('',views.fault_reports,name='fault_reports'),
]