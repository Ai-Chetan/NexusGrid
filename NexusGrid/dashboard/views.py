from django.shortcuts import redirect, render
from django.http import JsonResponse
from django.contrib.auth import authenticate, login
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from system_layout.models import System
import json

from django.urls import reverse

@login_required(login_url="/login/")
def dashboard_view(request):
    total_systems = System.objects.count()

    # Combine 'active' and 'inactive' as functional systems
    functional_count = System.objects.filter(status__in=['active', 'inactive']).count()
    critical_count = System.objects.filter(status='non-functional').count()
    active_count = System.objects.filter(status='active').count()

    # Prevent division by zero
    if total_systems > 0:
        functional_percent = (functional_count / total_systems) * 100
        critical_percent = (critical_count / total_systems) * 100
        active_percent = (active_count / total_systems) * 100
        system_utilization = round((active_count / functional_count) * 100, 2)
    else:
        functional_percent = critical_percent = active_percent = system_utilization = 0

    context = {
        'functional_count': functional_count,
        'critical_count': critical_count,
        'active_count': active_count,
        'total_systems': total_systems,
        'functional_percent': functional_percent,
        'critical_percent': critical_percent,
        'active_percent': active_percent,
        'system_utilization': system_utilization,
        'user_role': request.user.role,
    }
    return render(request, "dashboard/dashboard.html", context)

def user_logout(request):
    logout(request)  # Logs out the user
    return redirect(reverse("/login/"))