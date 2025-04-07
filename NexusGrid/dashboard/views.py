from django.shortcuts import redirect, render
from django.http import JsonResponse
from django.contrib.auth import authenticate, login
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from system_layout.models import System
from django.views.decorators.csrf import csrf_exempt
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
        system_utilization = round((active_count / (functional_count if functional_count != 0 else 1)) * 100, 2)
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

def qr_scanner(request):
    return render(request, 'dashboard/scan-qr.html')

@csrf_exempt
def scan_result(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            qr_data = data.get('qr_data', '')

            # For testing: print data in console
            print("QR Data:", qr_data)

            # Check if the scanned data is a digit (like an ID)
            if qr_data.isdigit():
                return JsonResponse({'redirect_url': f'/layout/details/{qr_data}/'})
            else:
                # Fallback: redirect to dashboard or error page
                return JsonResponse({'redirect_url': f'/dashboard/?qr_data={qr_data}'})

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)

    return JsonResponse({'error': 'Invalid request method'}, status=405)