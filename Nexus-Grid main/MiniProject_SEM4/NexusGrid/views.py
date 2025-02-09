
from django.shortcuts import render
from Python_Files import login, signup
from NexusGrid.models import User as CustomUser


# Create your views here.
def home(request):
   return render(request, 'home(temp).html')
  
def login(request):
    if request.method == 'POST':
        form_type = request.POST.get('form_type')

        if form_type == 'signin':
           login.login(request)
        elif form_type == 'signup':
            signup.user_signup(request) 
    return render(request, 'signin-signup-page.html')

def admin_dashboard(request):
    return render(request, 'admin_dashboard(temp).html')

def supervisor_dashboard(request):
    return render(request, 'supervisor_dashboard(temp).html')

def user_dashboard(request):
    return render(request, 'user_dashboard(temp).html')

