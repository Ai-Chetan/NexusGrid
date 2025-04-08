from django.utils import timezone
from django.shortcuts import render, redirect
from .models import ResourceRequest

def resource_requests(request):
    resource_requests = ResourceRequest.objects.select_related(
        'system_name',
        'requested_by',
        'system_name__system',
        'system_name__system__lab'
    ).order_by('-requested_at')

    # Debugging print statements
    for req in resource_requests:
        print(req.system_name.name)
        print(req.system_name.system.host_name)
        print(req.system_name.system.lab.lab_name)

    return render(request, 'resources/resources.html', {
        "user_role": request.user.role,
        "resource_requests": resource_requests,
    })


def update_resource_status(request, resource_id):
    if request.method == "POST":
        new_status = request.POST.get('status')
        
        try:
            resource_request = ResourceRequest.objects.get(resource_id=resource_id)
            resource_request.status = new_status

            if new_status == 'Approved':  # If approved, log the timestamp
                resource_request.provided_at = timezone.now()
            
            resource_request.save()
        except ResourceRequest.DoesNotExist:
            pass

    return redirect('resource_requests')
