from django.urls import path
from faults import views

urlpatterns = [
   path('', views.fault_reports, name='fault_reports'),
   path('update_status/<int:fault_id>/', views.update_fault_status, name='update_fault_status'),
]
