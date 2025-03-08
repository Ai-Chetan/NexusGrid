from django.contrib import admin
from django.urls import path
from login_manager import views

urlpatterns = [
   path('', views.login_page ,name='landing_page'),
   path('login/',views.landing_page,name='login_page'),
]