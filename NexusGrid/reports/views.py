from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.db.models import Count
from faults.models import FaultReport
from resources.models import ResourceRequest
from system_layout.models import System


@login_required(login_url="/login/")
def reports_view(request):
    context = {
        'page_title': 'Reports',
    }
    return render(request, 'reports/reports.html', context)


@login_required(login_url="/login/")
def reports_api(request):
    """Aggregate data for report charts and tables."""
    fault_by_status = dict(
        FaultReport.objects.values('status').annotate(n=Count('fault_id')).values_list('status', 'n')
    )
    fault_by_type = dict(
        FaultReport.objects.values('fault_type').annotate(n=Count('fault_id')).values_list('fault_type', 'n')
    )
    resource_by_status = dict(
        ResourceRequest.objects.values('status').annotate(n=Count('resource_id')).values_list('status', 'n')
    )
    system_by_status = dict(
        System.objects.values('status').annotate(n=Count('id')).values_list('status', 'n')
    )

    return JsonResponse({
        'fault_by_status': fault_by_status,
        'fault_by_type': fault_by_type,
        'resource_by_status': resource_by_status,
        'system_by_status': system_by_status,
    })
