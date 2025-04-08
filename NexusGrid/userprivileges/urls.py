from django.urls import path
from . import views

urlpatterns = [
    path('', views.user_privileges, name='admin_lab_privileges'),
    path('assign-role/', views.assign_role, name='assign_role'),
    path('update-lab/<str:lab_name>/', views.update_lab_assignment, name='update_lab_assignment'),
    path('remove-role/<int:user_id>/', views.remove_role, name='remove_role'),
    path('userprivileges/remove/<str:lab_name>/<str:user_type>/<int:user_id>/', views.remove_lab_user, name='remove_lab_user'),
]
