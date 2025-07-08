from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.db.models import Q
from .models import ResourceRequest, Provided
from .models import ResourceRequest
from system_layout.models import LayoutItem, Lab, System
from django.utils import timezone
from django.core.paginator import Paginator
import json

@login_required
def resource_requests(request):
    qs = ResourceRequest.objects.select_related(
        'system_name',
        'requested_by',
    )

    # Filtering
    search = request.GET.get('search', '').strip()
    status = request.GET.get('status', '').strip()
    time = request.GET.get('time', '').strip()
    sort = request.GET.get('sort', 'newest')
    start = request.GET.get('start', '')
    end = request.GET.get('end', '')

    if search:
        qs = qs.filter(
            Q(system_name__system__host_name__icontains=search) |
            Q(system_name__system__lab__lab_name__icontains=search) |
            Q(resource_name__icontains=search) |
            Q(description__icontains=search)
        )
    if status and status != 'all':
        qs = qs.filter(status__iexact=status)
    if time and time != 'all':
        now = timezone.now()
        if time == 'today':
            qs = qs.filter(requested_at__date=now.date())
        elif time == 'week':
            start_week = now - timezone.timedelta(days=now.weekday())
            qs = qs.filter(requested_at__date__gte=start_week.date())
        elif time == 'month':
            qs = qs.filter(requested_at__year=now.year, requested_at__month=now.month)
        elif time == 'custom' and start and end:
            qs = qs.filter(requested_at__date__gte=start, requested_at__date__lte=end)

    # Sorting
    if sort == 'oldest':
        qs = qs.order_by('requested_at')
    else:
        qs = qs.order_by('-requested_at')

    paginator = Paginator(qs, 10)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    return render(request, 'resources/resources.html', {
        "resource_requests": page_obj.object_list,
        "page_obj": page_obj,
    })

@login_required
@require_POST
def update_resource_status(request, resource_id):
    resource_request = get_object_or_404(ResourceRequest, resource_id=resource_id)
    new_status = request.POST.get('status')
    provision_summary = request.POST.get('provision_summary', '').strip()
    valid_statuses = ['Pending', 'Fulfilled', 'Denied']

    if new_status in valid_statuses:
        if new_status == 'Fulfilled':
            if not provision_summary:
                # Optionally, show an error message or redirect back with error
                return redirect('resource_requests')  # Or handle error
            Provided.objects.update_or_create(
                resource_request=resource_request,
                defaults={
                    'provision_summary': provision_summary,
                    'provided_by': request.user,
                }
            )
        resource_request.status = new_status
        resource_request.save()
    return redirect('resource_requests')

@login_required
@require_POST
def create_resource_request(request):
    data = json.loads(request.body)
    system_name = data.get('system_name', '').strip()
    lab_location = data.get('lab_location', '').strip()
    resource_name = data.get('resource_name', '').strip()
    description = data.get('description', '').strip()
    if not (system_name and lab_location and resource_name and description):
        return JsonResponse({'success': False, 'message': 'All fields required.'})
    try:
        # Find the system by name and lab
        system = System.objects.select_related('lab', 'layout_item').get(
            layout_item__name=system_name,
            lab__lab_name=lab_location
        )
        req = ResourceRequest.objects.create(
            system_name=system,  # <-- FIXED
            requested_by=request.user,
            resource_name=resource_name,
            description=description,
            status='Pending'
        )
        return JsonResponse({'success': True})
    except (System.DoesNotExist, LayoutItem.DoesNotExist):
        return JsonResponse({'success': False, 'message': 'System not found in the specified location.'})

@login_required
def get_systems_autocomplete(request):
    query = request.GET.get('q', '')
    systems = System.objects.select_related('layout_item', 'lab') \
        .filter(
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