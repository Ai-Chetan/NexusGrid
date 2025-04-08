from django.utils import timezone
from django.shortcuts import render, redirect
from .models import FaultReport

def fault_reports(request):
    fault_reports = FaultReport.objects.select_related(
        'system_name',
        'reported_by',
        'system_name__system',
        'system_name__system__lab'
    ).order_by('-reported_at')

    # Debugging print statements
    for report in fault_reports:
        print(report.system_name.name)
        print(report.system_name.system.host_name)
        print(report.system_name.system.lab.lab_name)

    return render(request, 'faults/faults.html', {
        "user_role": request.user.role,
        "fault_reports": fault_reports,
    })

def update_fault_status(request, fault_id):
    if request.method == "POST":
        new_status = request.POST.get('status')
        
        try:
            fault_report = FaultReport.objects.get(fault_id=fault_id)
            fault_report.status = new_status
            
            # If the status is 'resolved', set the resolved_at time
            if new_status == 'resolved':
                fault_report.resolved_at = timezone.now()  # Set the current time
            
            fault_report.save()
        except FaultReport.DoesNotExist:
            pass
    
    return redirect('fault_reports')