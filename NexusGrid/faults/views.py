from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.views.decorators.http import require_POST
from django.db.models import Q
from system_layout.models import LayoutItem, Lab, System
from .models import FaultReport, Resolved
from django.utils import timezone
import json
from django.core.paginator import Paginator

@login_required
def fault_reports(request):
    fault_reports_qs = FaultReport.objects.select_related(
        'system_name',
        'reported_by',
        'system_name__lab'
    )

    # Filtering
    search = request.GET.get('search', '').strip()
    status = request.GET.get('status', '').strip()
    time = request.GET.get('time', '').strip()
    sort = request.GET.get('sort', 'newest')
    start = request.GET.get('start', '')
    end = request.GET.get('end', '')

    if search:
        fault_reports_qs = fault_reports_qs.filter(
            Q(system_name__host_name__icontains=search) |
            Q(system_name__lab__lab_name__icontains=search) |
            Q(fault_type__icontains=search) |
            Q(description__icontains=search)
        )
    if status and status != 'all':
        fault_reports_qs = fault_reports_qs.filter(status=status)
    if time and time != 'all':
        from django.utils import timezone
        now = timezone.now()
        if time == 'today':
            fault_reports_qs = fault_reports_qs.filter(reported_at__date=now.date())
        elif time == 'week':
            week_ago = now - timezone.timedelta(days=7)
            fault_reports_qs = fault_reports_qs.filter(reported_at__gte=week_ago)
        elif time == 'month':
            month_ago = now - timezone.timedelta(days=30)
            fault_reports_qs = fault_reports_qs.filter(reported_at__gte=month_ago)
        elif time == 'custom':
            if start:
                fault_reports_qs = fault_reports_qs.filter(reported_at__date__gte=start)
            if end:
                fault_reports_qs = fault_reports_qs.filter(reported_at__date__lte=end)
    # Sorting
    if sort == 'oldest':
        fault_reports_qs = fault_reports_qs.order_by('reported_at')
    else:
        fault_reports_qs = fault_reports_qs.order_by('-reported_at')

    paginator = Paginator(fault_reports_qs, 10)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    return render(request, 'faults/faults.html', {
        "fault_reports": page_obj.object_list,
        "page_obj": page_obj,
    })

@login_required
@require_POST
def update_fault_status(request, fault_id):
    fault_report = get_object_or_404(FaultReport, fault_id=fault_id)
    new_status = request.POST.get('status')

    if new_status in dict(FaultReport.STATUS_CHOICES):
        fault_report.status = new_status
        fault_report.save()
        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'success': True, 'status': new_status})
        messages.success(request, f'Status updated to {fault_report.get_status_display()}')
    else:
        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'message': 'Invalid status selected'})
        messages.error(request, 'Invalid status selected')

    return redirect('fault_reports')

@login_required
def create_fault_report(request):
    if request.method == 'POST':
        system_name = request.POST.get('system_name')
        lab_location = request.POST.get('lab_location')
        fault_type = request.POST.get('fault_type')
        description = request.POST.get('description')

        system_types = [
            'computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack'
        ]

        try:
            # Validate system exists using System model
            system = System.objects.select_related('lab', 'layout_item').get(
                layout_item__name=system_name,
                layout_item__item_type__in=system_types,
                lab__lab_name=lab_location
            )

            fault_report = FaultReport.objects.create(
                system_name=system,
                reported_by=request.user,
                fault_type=fault_type,
                description=description
            )

            return JsonResponse({
                'success': True,
                'message': 'Fault report created successfully',
                'fault_id': fault_report.fault_id
            })

        except System.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': 'System not found in the specified location'
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': str(e)
            })

    return JsonResponse({'success': False, 'message': 'Invalid request method'})

@login_required
def get_systems_autocomplete(request):
    query = request.GET.get('q', '')
    system_types = [
        'computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack'
    ]

    systems = System.objects.select_related('layout_item', 'lab') \
        .filter(
            layout_item__item_type__in=system_types,
            layout_item__name__icontains=query
        )[:10]

    results = [
        {
            'name': system.layout_item.name,
            'lab': system.lab.lab_name if system.lab else '',
            'display': f"{system.layout_item.name} - {system.lab.lab_name}" if system.lab else system.layout_item.name
        }
        for system in systems
    ]

    return JsonResponse({'results': results})

@login_required
def get_labs_autocomplete(request):
    query = request.GET.get('q', '')
    labs = Lab.objects.filter(lab_name__icontains=query)[:10]

    results = [{'name': lab.lab_name} for lab in labs]
    return JsonResponse({'results': results})

@login_required
@require_POST
def resolve_fault(request, fault_id):
    fault_report = get_object_or_404(FaultReport, fault_id=fault_id)
    if fault_report.status != 'resolved':
        return JsonResponse({'success': False, 'message': 'Fault must be marked as resolved first.'})

    try:
        data = json.loads(request.body)
        summary = data.get('resolution_summary', '').strip()
        if not summary:
            return JsonResponse({'success': False, 'message': 'Resolution summary is required.'})

        # Prevent duplicate
        if hasattr(fault_report, 'resolved'):
            return JsonResponse({'success': False, 'message': 'Resolution already exists.'})

        Resolved.objects.create(
            fault_report=fault_report,
            resolution_summary=summary,
            resolved_by=request.user,
            resolved_at=timezone.now()
        )
        return JsonResponse({'success': True, 'message': 'Resolution summary saved.'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})