import datetime
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.db import transaction
import json
import psutil
import platform
import socket
from .models import LayoutItem, Lab, System
from login_manager.models import User
from faults.models import FaultReport
from monitoring.models import SystemInfo

@login_required(login_url="/login/")
def layout_view(request, item_id=None):
    if item_id:
        current_item = get_object_or_404(LayoutItem, id=int(item_id))  
        parent = current_item
        breadcrumb = [{'id': ancestor.id, 'name': ancestor.name} for ancestor in parent.get_ancestors()]
    else:
        current_item = None
        parent = None
        breadcrumb = []

    # Get lab_name from parent (room)
    lab_name = None
    if parent and parent.item_type == 'room':
        lab = Lab.objects.filter(layout_item_id=parent.id).first()
        if lab:
            lab_name = lab.lab_name

    systems = System.objects.filter(lab_id=lab_name) if lab_name else System.objects.none()
    total_systems = systems.count()

    functional_count = systems.filter(status__in=['active', 'inactive']).count()
    critical_count = systems.filter(status='non-functional').count()
    active_count = systems.filter(status='active').count()

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
        'parent': parent,
        'breadcrumb': breadcrumb,
        'parent_id': parent.id if parent else None,
    }

    return render(request, 'system-layout/system-layout.html', context)

def system_details(request, item_id=None):
    if item_id:
        system_info = get_system_info()
        return render(request, 'system-layout/system-details.html', {"system_info": system_info})
    return HttpResponse("Invalid request", status=400)

def get_layout_items(request):
    parent_id = request.GET.get('parent_id')
    parent_id = int(parent_id) if parent_id and parent_id.isdigit() else None 
    
    items = LayoutItem.objects.filter(parent_id=parent_id) if parent_id else LayoutItem.objects.filter(parent__isnull=True)

    item_list = []
    for item in items:
        item_dict = item.to_dict()
        
        # If item is a computer, fetch status from system table
        if item.item_type == 'computer':
            system = System.objects.filter(layout_item_id=item.id).first()
            item_dict['status'] = system.status if system else None  # Could be 'active', 'inactive', etc.
        else:
            item_dict['status'] = None

        item_list.append(item_dict)

    return JsonResponse({'items': item_list})

def get_parent(request):
    item_id = request.GET.get('item_id')
    try:
        item = get_object_or_404(LayoutItem, id=int(item_id))
        return JsonResponse({'parent_id': item.parent.id if item.parent else None})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


@csrf_exempt
def add_layout_item(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)
    
    try:
        with transaction.atomic():
            data = json.loads(request.body)
            parent_id = data.get('parent_id')
            
            # Handle null parent_id properly
            if parent_id == 'null' or parent_id is None:
                parent = None
            else:
                parent = get_object_or_404(LayoutItem, id=int(parent_id))
            
            item = LayoutItem.objects.create(
                name=data.get('name'),
                item_type=data.get('item_type'),
                parent=parent,
                position_x=data.get('position_x', 0),
                position_y=data.get('position_y', 0),
                width=data.get('width', 1),
                height=data.get('height', 1)
            )
            return JsonResponse({'status': 'success', 'item': item.to_dict()})
    except Exception as e:
        import traceback
        return JsonResponse({
            'status': 'error', 
            'message': str(e),
            'traceback': traceback.format_exc(),
            'request_data': json.loads(request.body) if request.body else {}
        }, status=400)
    
@csrf_exempt
def update_layout_item(request, item_id):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)
    
    try:
        item = get_object_or_404(LayoutItem, id=int(item_id))
        data = json.loads(request.body)
        
        for field in ['name', 'position_x', 'position_y']:
            if field in data:
                setattr(item, field, data[field])
        
        item.save()
        return JsonResponse({'status': 'success', 'item': item.to_dict()})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


@csrf_exempt
def delete_layout_item(request, item_id):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)
    
    try:
        item = get_object_or_404(LayoutItem, id=int(item_id))
        
        # Check if item has related objects in System or Lab models
        if hasattr(item, 'system'):
            item.system.delete()
        
        if hasattr(item, 'lab'):
            item.system.delete()
            
        # Check if item has children
        if item.children.exists():
            # Either delete children first or return an error
            return JsonResponse({'status': 'error', 'message': 'Cannot delete - item has child items'}, status=400)
            
        item.delete()
        return JsonResponse({'status': 'success'})
    except Exception as e:
        import traceback
        return JsonResponse({'status': 'error', 'message': str(e), 'traceback': traceback.format_exc()}, status=400)

@csrf_exempt
def save_layout(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)
    
    try:
        data = json.loads(request.body)
        items = data.get('items', [])
        
        with transaction.atomic():
            for item_data in items:
                item_id = int(item_data.get('id'))
                item = get_object_or_404(LayoutItem, id=item_id)
                item.position_x = item_data.get('position_x', item.position_x)
                item.position_y = item_data.get('position_y', item.position_y)
                item.save()
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


def get_system_info():
    try:
        current_host = socket.gethostname()
        system_info = SystemInfo.objects.filter(hostname=current_host).order_by('-timestamp').first()

        if not system_info:
            return {}

        info = {
            "System Information": {
                "Hostname": system_info.hostname,
                "System": system_info.system,
                "Version": system_info.version,
                "Release": system_info.release,
                "Machine": system_info.machine,
                "Processor": system_info.processor,
                "Architecture": system_info.architecture
            },
            "CPU Information": {
                "Physical Cores": system_info.cpu_physical_cores,
                "Total Cores": system_info.cpu_total_cores,
                "Max Frequency (MHz)": system_info.cpu_max_freq,
                "Min Frequency (MHz)": system_info.cpu_min_freq,
                "Current Frequency (MHz)": system_info.cpu_current_freq,
                "CPU Usage (%)": system_info.cpu_usage
            },
            "Memory Information": {
                "Total Memory (GB)": system_info.memory_total,
                "Available Memory (GB)": system_info.memory_available,
                "Used Memory (GB)": system_info.memory_used,
                "Memory Usage (%)": system_info.memory_usage_percent
            },
            "Disk Information": {
                "Total Disk Space (GB)": system_info.disk_total,
                "Used Disk Space (GB)": system_info.disk_used,
                "Free Disk Space (GB)": system_info.disk_free,
                "Disk Usage (%)": system_info.disk_usage_percent
            },
            "Network Information": {
                "IP Address": system_info.ip_address,
                "Bytes Sent": system_info.bytes_sent,
                "Bytes Received": system_info.bytes_received
            },
            "User Information": {
                "Users Count": system_info.users_count,
                "Logged In Users": system_info.logged_in_users
            },
            "Timestamp": system_info.timestamp
        }

        return info

    except Exception as e:
        print(f"Error fetching system info: {e}")
        return {}
    
@csrf_exempt
def report_fault(request):
    if request.method == 'POST':
        try:
            # Parse incoming JSON data
            data = json.loads(request.body)
            
            # Retrieve the necessary fields
            title = data.get('title')
            description = data.get('description')
            system_name_id = data.get('system_name')
            reported_by_id = data.get('reported_by')
            fault_type = data.get('fault_type', 'Hardware')  # Defaulting to 'Hardware'
            status = data.get('status', 'Pending')  # Defaulting to 'Pending'

            # Get LayoutItem and User objects
            system_name = LayoutItem.objects.get(id=system_name_id)
            reported_by = User.objects.get(id=reported_by_id)

            # Create and save the FaultReport
            fault_report = FaultReport(
                system_name=system_name,
                reported_by=reported_by,
                fault_type=fault_type,
                description=description,
                status=status
            )

            fault_report.save()

            return JsonResponse({'status': 'success', 'message': 'Fault report submitted successfully.'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    return JsonResponse({'status': 'error', 'message': 'Invalid request method.'}, status=405)

# def generate_qr(request, computer_id):
#     # Fetch the computer from the database
#     computer = get_object_or_404(LayoutItem, unique_id=computer_id)

#     # Generate a QR code for the computer ID
#     qr = qrcode.make(computer.unique_id)
#     buffer = BytesIO()
#     qr.save(buffer, format="PNG")
#     buffer.seek(0)

#     # Return the image as an HTTP response
#     return HttpResponse(buffer.getvalue(), content_type="image/png")