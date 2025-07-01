from django.urls import path
from . import views

app_name = 'layout'  # Namespace

urlpatterns = [
    path("", views.layout_view, name="root"),
    path("<int:item_id>/", views.layout_view, name="layout_view"),
    # path("details/<int:item_id>/", views.system_details, name="layout_details"),
    path("add_layout_item/", views.add_layout_item, name="add_layout_item"),
    path("update_layout_item/<int:item_id>/", views.update_layout_item, name="update_layout_item"),
    path("delete_layout_item/<int:item_id>/", views.delete_layout_item, name="delete_layout_item"),
    path("get_layout_items/", views.get_layout_items, name="get_layout_items"),
    path("get_parent/", views.get_parent, name="get_parent"),
    path("save/", views.save_layout, name="save_layout"),
    path('report_fault/', views.submit_fault_report, name='submit_fault_report'),
]