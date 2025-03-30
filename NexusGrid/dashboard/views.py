from django.shortcuts import redirect, render
from django.http import JsonResponse
from django.contrib.auth import authenticate, login
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
import json

from django.urls import reverse

@login_required(login_url="/login/")
def dashboard_view(request):
    return render(request, "dashboard/dashboard.html", {"user_role": request.user.role})

def user_logout(request):
    logout(request)  # Logs out the user
    return redirect(reverse("/login/"))