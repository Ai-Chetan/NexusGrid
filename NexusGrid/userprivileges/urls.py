# urls.py
from django.urls import path
from . import views

app_name = 'user_privileges'

urlpatterns = [
    # Main template view
    path('', views.UserPrivilegesView.as_view(), name='index'),
    
    # API endpoints
    path('api/stats/', views.stats_api, name='stats_api'),
    path('api/buildings/', views.buildings_api, name='buildings_api'),
    path('api/floors/<int:building_id>/', views.floors_api, name='floors_api'),
    path('api/labs/<int:floor_id>/', views.labs_api, name='labs_api'),
    path('api/users/', views.users_api, name='users_api'),
    path('api/users/<int:user_id>/', views.user_detail_api, name='user_detail_api'),
    path('api/available-instructors/', views.available_instructors_api, name='available_instructors_api'),
    path('api/available-assistants/', views.available_assistants_api, name='available_assistants_api'),
    path('api/assign-staff/', views.assign_staff_api, name='assign_staff_api'),
    path('api/remove-staff/', views.remove_staff_api, name='remove_staff_api'),
    path('api/settings/', views.settings_api, name='settings_api'),
    path('api/save/', views.capacity_and_dimension_api, name='capacity_and_dimension_api'),
]