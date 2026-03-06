from django.urls import path
from . import views

urlpatterns = [
    # Auth
    path('auth/login/', views.LoginView.as_view(), name='api-login'),
    path('auth/logout/', views.LogoutView.as_view(), name='api-logout'),
    path('auth/me/', views.MeView.as_view(), name='api-me'),
    path('auth/register/', views.RegisterView.as_view(), name='api-register'),
    path('auth/signup-otp/', views.SignupRequestOTPView.as_view(), name='api-signup-otp'),
    path('auth/signup-verify/', views.SignupVerifyOTPView.as_view(), name='api-signup-verify'),
    path('auth/forgot-password/', views.ForgotPasswordRequestView.as_view(), name='api-forgot-password'),
    path('auth/forgot-password-verify/', views.ForgotPasswordVerifyView.as_view(), name='api-forgot-password-verify'),

    # Dashboard
    path('dashboard/metrics/', views.DashboardMetricsView.as_view(), name='api-dashboard-metrics'),

    # Layout Items
    path('layout/items/', views.LayoutItemsView.as_view(), name='api-layout-items'),
    path('layout/items/<int:pk>/', views.LayoutItemDetailView.as_view(), name='api-layout-item-detail'),
    path('layout/breadcrumb/<int:pk>/', views.LayoutBreadcrumbView.as_view(), name='api-layout-breadcrumb'),

    # Systems
    path('layout/systems/<int:pk>/', views.SystemDetailView.as_view(), name='api-system-detail'),
    path('layout/systems/', views.SystemsListView.as_view(), name='api-systems-list'),

    # Labs
    path('layout/labs/', views.LabListView.as_view(), name='api-labs-list'),
    path('layout/labs/<int:pk>/', views.LabDetailView.as_view(), name='api-lab-detail'),

    # Faults
    path('faults/', views.FaultListView.as_view(), name='api-faults-list'),
    path('faults/<int:pk>/', views.FaultDetailView.as_view(), name='api-fault-detail'),

    # Resources
    path('resources/', views.ResourceListView.as_view(), name='api-resources-list'),
    path('resources/<int:pk>/', views.ResourceDetailView.as_view(), name='api-resource-detail'),

    # Reports
    path('reports/', views.ReportsView.as_view(), name='api-reports'),

    # Monitoring
    path('monitoring/', views.MonitoringView.as_view(), name='api-monitoring'),

    # Users / Privileges
    path('users/', views.UserListView.as_view(), name='api-users-list'),
    path('users/<int:pk>/', views.UserDetailView.as_view(), name='api-user-detail'),
    path('privileges/stats/', views.UserPrivilegesStatsView.as_view(), name='api-privileges-stats'),
    path('privileges/assignments/', views.LabAssignmentListView.as_view(), name='api-lab-assignments'),
    path('privileges/assignments/<int:pk>/', views.LabAssignmentDetailView.as_view(), name='api-lab-assignment-detail'),
    path('privileges/config/', views.PrivilegesConfigView.as_view(), name='api-privileges-config'),

    # Profile / OTP
    path('profile/request-otp/', views.ProfileRequestOTPView.as_view(), name='api-profile-request-otp'),
    path('profile/verify-otp/', views.ProfileVerifyOTPView.as_view(), name='api-profile-verify-otp'),
    path('profile/delete/', views.DeleteAccountView.as_view(), name='api-profile-delete'),
]
