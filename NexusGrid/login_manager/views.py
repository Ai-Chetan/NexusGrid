from django.shortcuts import render
from django.contrib.auth import authenticate, login
from django.contrib import messages

# Create your views here.
def landing_page(request):
    return render(request, 'login_manager/signin-signup-page.html')

def login_page(request):
    return render(request,'login_manager/landing-page.html' )

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