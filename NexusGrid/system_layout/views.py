from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.db import transaction
import json
import psutil
import platform
import socket
from .models import LayoutItem

@login_required(login_url="/login/")
def layout_view(request, item_id=None):
    if item_id:
        current_item = get_object_or_404(LayoutItem, id=int(item_id))  
        parent = current_item
        
        # Get ancestors for breadcrumb
        breadcrumb = [{'id': ancestor.id, 'name': ancestor.name} for ancestor in parent.get_ancestors()]
    else:
        current_item = None
        parent = None
        breadcrumb = []

    # Merge context dictionaries
    context = {
        'parent': parent,
        'breadcrumb': breadcrumb,
        'parent_id': parent.id if parent else None,
        'user_role': request.user.role,  # Include user_role in context
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
    
    return JsonResponse({'items': [item.to_dict() for item in items]})


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
        data = json.loads(request.body)
        parent_id = data.get('parent_id')
        parent = get_object_or_404(LayoutItem, id=int(parent_id)) if parent_id and parent_id.isdigit() else None
        
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
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


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
        item.delete()
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


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
        info = {
            "System Information": {
                "Hostname": socket.gethostname(),
                "System": platform.system(),
                "Version": platform.version(),
                "Release": platform.release(),
                "Machine": platform.machine(),
                "Processor": platform.processor(),
                "Architecture": platform.architecture()[0]
            },
            "CPU Information": {
                "Physical Cores": psutil.cpu_count(logical=False),
                "Total Cores": psutil.cpu_count(logical=True),
                "Max Frequency (MHz)": psutil.cpu_freq().max,
                "Min Frequency (MHz)": psutil.cpu_freq().min,
                "Current Frequency (MHz)": psutil.cpu_freq().current,
                "CPU Usage (%)": psutil.cpu_percent(interval=1)
            },
            "Memory Information": {
                "Total Memory (GB)": round(psutil.virtual_memory().total / (1024 ** 3), 2),
                "Available Memory (GB)": round(psutil.virtual_memory().available / (1024 ** 3), 2),
                "Used Memory (GB)": round(psutil.virtual_memory().used / (1024 ** 3), 2),
                "Memory Usage (%)": psutil.virtual_memory().percent
            },
            "Disk Information": {
                "Total Disk Space (GB)": round(psutil.disk_usage('/').total / (1024 ** 3), 2),
                "Used Disk Space (GB)": round(psutil.disk_usage('/').used / (1024 ** 3), 2),
                "Free Disk Space (GB)": round(psutil.disk_usage('/').free / (1024 ** 3), 2),
                "Disk Usage (%)": psutil.disk_usage('/').percent
            },
            "Network Information": {
                "IP Address": socket.gethostbyname(socket.gethostname())
            }
        }
        return info
    except Exception as e:
        print(f"Error fetching system info: {e}")
        return {}