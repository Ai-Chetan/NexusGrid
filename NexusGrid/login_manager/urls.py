from django.contrib import admin
from django.urls import path
from login_manager import views

urlpatterns = [
   path('', views.login_page ,name='landing_page'),
   path('login/',views.landing_page,name='login_page'),
   path('user-login/',views.user_login,name='user_login'),
   path("get-otp/", views.get_otp, name="get_otp"),
   path("verify-otp/", views.verify_otp, name="verify_otp"),
]