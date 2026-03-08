from django.urls import path

from tenant_control import views


urlpatterns = [
    path("packages/", views.ControlPlanePackageListView.as_view(), name="control-packages"),
    path("tenants/", views.ControlPlaneTenantListCreateView.as_view(), name="control-tenants"),
    path("tenants/<slug:slug>/", views.ControlPlaneTenantDetailView.as_view(), name="control-tenant-detail"),
    path("tenants/<slug:slug>/deprovision/", views.ControlPlaneTenantDeprovisionView.as_view(), name="control-tenant-deprovision"),
    path("tenants/<slug:slug>/domains/<int:domain_id>/", views.ControlPlaneTenantDomainDeleteView.as_view(), name="control-tenant-domain-delete"),
]
