from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.db.models import Q
from .models import ResourceRequest
from system_layout.models import LayoutItem
from django.utils import timezone
from django.core.paginator import Paginator

@login_required
def resource_requests(request):
    qs = ResourceRequest.objects.select_related(
        'system_name',
        'requested_by',
        'system_name__system',
        'system_name__system__lab'
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
            Q(resource_type__icontains=search) |
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
    valid_statuses = ['Pending', 'In Progress', 'Approved', 'Fulfilled', 'Denied']
    if new_status in valid_statuses:
        resource_request.status = new_status
        if new_status == 'Approved':
            resource_request.provided_at = timezone.now()
        resource_request.save()
    return redirect('resource_request')

@login_required
@require_POST
def create_resource_request(request):
    import json
    data = json.loads(request.body)
    system_name = data.get('system_name', '').strip()
    resource_type = data.get('resource_type', '').strip()
    description = data.get('description', '').strip()
    if not (system_name and resource_type and description):
        return JsonResponse({'success': False, 'message': 'All fields required.'})
    try:
        layout_item = LayoutItem.objects.get(name=system_name)
        req = ResourceRequest.objects.create(
            system_name=layout_item,
            requested_by=request.user,
            resource_type=resource_type,
            description=description,
            status='Pending'
        )
        return JsonResponse({'success': True})
    except LayoutItem.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'System not found.'})