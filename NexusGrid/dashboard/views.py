from django.shortcuts import redirect, render
from django.http import JsonResponse
from django.contrib.auth import authenticate, login
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from faults.models import FaultReport
from resources.models import ResourceRequest
from system_layout.models import Lab, System
from django.views.decorators.csrf import csrf_exempt
import json
from django.db.models.functions import TruncMonth
from django.db.models import Count
from django.utils.timezone import now
from datetime import timedelta
from django.urls import reverse

@login_required(login_url="/login/")
def dashboard_view(request):
    total_systems = System.objects.count()

    functional_count = System.objects.filter(status__in=['active', 'inactive']).count()
    critical_count = System.objects.filter(status='non-functional').count()
    active_count = System.objects.filter(status='active').count()

    if total_systems > 0:
        functional_percent = (functional_count / total_systems) * 100
        critical_percent = (critical_count / total_systems) * 100
        active_percent = (active_count / total_systems) * 100
        system_utilization = round((active_count / (functional_count if functional_count != 0 else 1)) * 100, 2)
    else:
        functional_percent = critical_percent = active_percent = system_utilization = 0

    six_months_ago = now() - timedelta(days=180)

    # Fault Trend (serialize datetime)
    fault_trend_qs = (
        FaultReport.objects
        .filter(reported_at__gte=six_months_ago)
        .annotate(month=TruncMonth("reported_at"))
        .values("month")
        .annotate(count=Count("fault_id"))
        .order_by("month")
    )

    fault_trend_data = [
        {'month': item['month'].isoformat(), 'count': item['count']}
        for item in fault_trend_qs
    ]

    # Fault Distribution
    fault_distribution_data = list(
        FaultReport.objects
        .values("fault_type")
        .annotate(count=Count("fault_id"))
    )

    # Resource Trend (serialize datetime)
    resource_trend_qs = (
        ResourceRequest.objects
        .filter(requested_at__gte=six_months_ago)
        .annotate(month=TruncMonth("requested_at"))
        .values("month")
        .annotate(count=Count("resource_id"))
        .order_by("month")
    )
    # System Status Distribution
    system_status_distribution = list(
        System.objects
        .values('status')
        .annotate(count=Count('id'))
    )
    resource_trend_data = [
        {'month': item['month'].isoformat(), 'count': item['count']}
        for item in resource_trend_qs
    ]
    assistant_labs = []
    if request.user.role == 'Lab Assistant':
        assistant_labs = Lab.objects.filter(assistants=request.user).select_related('layout_item')

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
        'fault_trend_data': fault_trend_data,
        'fault_distribution_data': fault_distribution_data,
        'resource_trend_data': resource_trend_data,
        'system_status_distribution': system_status_distribution,
        'assistant_labs': assistant_labs,
    }

    return render(request, "dashboard/dashboard.html", context)

def user_logout(request):
    logout(request)  # Logs out the user
    return redirect(reverse("/login/"))

@login_required(login_url="/login/")
def qr_scanner(request):
    context = {
        'user_role': request.user.role
    }
    return render(request, 'dashboard/scan-qr.html', context)

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