from django.urls import path

from rbac import views


urlpatterns = [
    path("permissions/", views.PermissionListView.as_view(), name="rbac-permissions"),
    path("roles/", views.RoleListCreateView.as_view(), name="rbac-roles"),
    path("roles/<int:pk>/", views.RoleDetailView.as_view(), name="rbac-role-detail"),
    path("roles/<int:pk>/permissions/", views.RolePermissionsView.as_view(), name="rbac-role-permissions"),
    path("users/<int:user_id>/roles/", views.UserRoleAssignmentsView.as_view(), name="rbac-user-roles"),
]
