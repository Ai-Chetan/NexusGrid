from django.shortcuts import render

# Create your views here.
def landing_page(request):
    return render(request, 'login_manager/signin-signup-page.html')

def login_page(request):
    return render(request,'login_manager/landing-page.html' )