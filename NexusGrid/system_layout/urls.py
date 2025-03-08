from django.urls import path
from . import views

urlpatterns = [
    path("", views.system_layout, name="system_layout"),
    path("add_block/", views.add_block, name="add_block"),
    path("update_block/<int:block_id>/", views.update_block, name="update_block"),
    path("remove_block/<int:block_id>/", views.remove_block, name="remove_block"),
]
