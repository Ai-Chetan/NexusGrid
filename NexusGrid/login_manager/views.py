from django.shortcuts import render,redirect
from django.contrib.auth import authenticate, login
from django.contrib import messages
import random

# Create your views here.
def landing_page(request):
    return render(request, 'login_manager/landing-page.html')

def login_page(request):
    if request.method=='POST':
        email = request.POST.get('email')
        action=request.POST.get('action') 
        if action=='get_otp':
            print('get_otp')  
        elif action=='validate_otp':
            print('validate_otp')
        elif action=='signup':
            print('signup')    
    return render(request,'login_manager/signin-signup-page.html' )

def user_login(request):
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect("dashboard")  # Redirect to dashboard after login
        else:
            messages.error(request, "Invalid username or password")

    return render(request, "login_manager/login.html")