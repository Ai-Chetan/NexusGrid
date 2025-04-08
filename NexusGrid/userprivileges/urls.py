from django.urls import path
from . import views

urlpatterns = [
    path('', views.admin_lab_privileges, name='admin_lab_privileges'),
    # path('labs/delete/', views.delete_lab, name='delete_lab'),
    # path('labs/add/', views.add_lab, name='add_lab'),
    # path('labs/add-incharge/', views.add_lab_incharge, name='add_lab_incharge'),
    # path('labs/add-assistant/', views.add_lab_assistant, name='add_lab_assistant'),
    # path('labs/remove-member/', views.remove_lab_member, name='remove_lab_member'),
    # path('members/add/', views.add_member, name='add_member'),
    # path('settings/update/', views.update_settings, name='update_settings'),
]