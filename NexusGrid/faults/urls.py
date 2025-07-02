from django.urls import path
from faults import views

urlpatterns = [
   path('', views.fault_reports, name='fault_reports'),
   path('update_status/<int:fault_id>/', views.update_fault_status, name='update_fault_status'),
   path('systems-autocomplete/', views.get_systems_autocomplete, name='get_systems_autocomplete'),
   path('labs-autocomplete/', views.get_labs_autocomplete, name='get_labs_autocomplete'),
   path('create/', views.create_fault_report, name='create_fault_report'),
   path('resolve/<int:fault_id>/', views.resolve_fault, name='resolve_fault'),
]
