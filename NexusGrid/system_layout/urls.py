from django.urls import path
from . import views

urlpatterns = [
    path("", views.layout_view, name="system_layout"),
    path("add_layout_item/", views.add_layout_item, name="add_layout_item"),
    path("update_layout_item/<int:item_id>/", views.update_layout_item, name="update_layout_item"),
    path("delete_layout_item/<int:item_id>/", views.delete_layout_item, name="delete_layout_item"),
    path("get_layout_items/", views.get_layout_items, name="get_layout_items"),
    path("save_layout/", views.save_layout, name="save_layout"),
    path('<int:id>/', views.item_detail, name='item_detail'),
]