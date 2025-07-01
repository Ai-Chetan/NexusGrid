from django.utils import timezone
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.db import transaction
import json
from django.views.decorators.http import require_POST
from .models import LayoutItem, Lab, System
from login_manager.models import User
from faults.models import FaultReport
from resources.models import ResourceRequest

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
    lab = None
    if parent and parent.item_type == 'room':
        lab = Lab.objects.filter(layout_item_id=parent.id).first()

    systems = System.objects.filter(lab=lab) if lab else System.objects.none()

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

# def system_details(request, item_id=None):
#     if not item_id:
#         return HttpResponse("Invalid request", status=400)

#     try:
#         print(f"[DEBUG] Requested LayoutItem ID: {item_id}")

#         layout_item = get_object_or_404(LayoutItem, id=item_id)
#         print(f"[DEBUG] LayoutItem fetched: {layout_item.name} (ID: {layout_item.id})")

#         # Get associated system
#         system = System.objects.filter(layout_item_id=layout_item.id).first()
#         if not system or not system.host_name:
#             print("[DEBUG] No associated System or host_name found.")
#             return HttpResponse("No associated system or hostname found", status=404)

#         hostname = system.host_name
#         print(f"[DEBUG] Hostname from System table: {hostname}")

#         # Get latest SystemInfo for hostname
#         system_info = SystemInfo.objects.filter(hostname=hostname).order_by('-timestamp').first()
#         if not system_info:
#             print(f"[DEBUG] No SystemInfo record found for hostname: {hostname}")
#             return HttpResponse("System info not found for this host", status=404)

#         print(f"[DEBUG] SystemInfo found for hostname: {hostname} (Timestamp: {system_info.timestamp})")

#         # Pass everything needed to the template
#         context = {
#             "layout_item": layout_item,
#             "system": system,
#             "system_info": system_info,
#         }
#         return render(request, 'system-layout/system-details.html', context)

    # except Exception as e:
    #     print(f"[ERROR] Exception occurred: {str(e)}")
    #     return HttpResponse(f"Error fetching system details: {str(e)}", status=500)

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

            parent = None if parent_id in [None, 'null'] else get_object_or_404(LayoutItem, id=int(parent_id))

            item = LayoutItem.objects.create(
                name=data.get('name'),
                item_type=data.get('item_type'),
                parent=parent,
                position_x=data.get('position_x', 0),
                position_y=data.get('position_y', 0),
                width=data.get('width', 1),
                height=data.get('height', 1)
            )

            # Auto-create Lab or System
            if item.item_type == 'room':
                # Get ancestors for location: e.g., Building > Floor
                ancestors = item.get_ancestors()
                location_parts = [a.name for a in ancestors]
                location = " > ".join(location_parts) if location_parts else "Unknown"

                Lab.objects.create(
                    layout_item=item,
                    lab_name=item.name,
                    location=location
                )

            elif item.item_type in ['computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack']:
                parent_lab = None
                ancestor = item.parent
                while ancestor:
                    if hasattr(ancestor, 'lab'):
                        parent_lab = ancestor.lab
                        break
                    ancestor = ancestor.parent

                System.objects.create(
                    layout_item=item,
                    lab=parent_lab,
                    host_name=item.name,
                    updated_at=timezone.now(),
                    updated_by_id=request.user.id if request.user.is_authenticated else None
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

        name_changed = False
        for field in ['name', 'position_x', 'position_y']:
            if field in data:
                setattr(item, field, data[field])
                if field == 'name':
                    name_changed = True

        item.save()

        # Update Lab name if applicable
        if item.item_type == 'room' and hasattr(item, 'lab') and name_changed:
            item.lab.lab_name = item.name
            item.lab.save()

        # Update System host_name and metadata if it's a system item
        if item.item_type in ['computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack']:
            if hasattr(item, 'system'):
                item.system.host_name = item.name
                item.system.updated_at = timezone.now()
                if request.user.is_authenticated:
                    item.system.updated_by_id = request.user.id
                item.system.save()

        return JsonResponse({'status': 'success', 'item': item.to_dict()})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
def delete_layout_item(request, item_id):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

    try:
        item = get_object_or_404(LayoutItem, id=int(item_id))

        # if item.children.exists():
        #     return JsonResponse({'status': 'error', 'message': 'Cannot delete - item has child items'}, status=400)

        # Delete related Lab/System safely
        if hasattr(item, 'system'):
            item.system.delete()
        if hasattr(item, 'lab'):
            item.lab.delete()

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

@csrf_exempt
def submit_fault_report(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            fault_type = data.get("fault_type")
            description = data.get("description")
            title = data.get("title")
            system_id = data.get("system_id")

            if not fault_type or not description or not system_id:
                return JsonResponse({"error": "Missing required fields."}, status=400)

            if not request.user.is_authenticated:
                return JsonResponse({"error": "User not authenticated."}, status=401)

            full_description = f"Title: {title}\n\n{description}" if title else description

            report = FaultReport.objects.create(
                fault_type=fault_type,
                description=full_description,
                reported_by=request.user,
                system_name_id=system_id,
                status="Pending"  # Set default status
            )

            return JsonResponse({"message": "Fault reported successfully.", "fault_id": report.fault_id}, status=201)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid method"}, status=405)

@csrf_exempt
def submit_resource_request(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            resource_type = data.get("resource_type")
            description = data.get("resource_name")  # mapping "resource_name" from frontend to "description"
            system_id = data.get("system_id")

            if not resource_type or not description or not system_id:
                return JsonResponse({"error": "Missing required fields."}, status=400)

            if not request.user.is_authenticated:
                return JsonResponse({"error": "User not authenticated."}, status=401)

            request_entry = ResourceRequest.objects.create(
                resource_type=resource_type,
                description=description,
                system_name_id=system_id,
                requested_by=request.user,
                status="Pending"  # Set default status
            )

            return JsonResponse({
                "message": "Resource request submitted successfully.",
                "request_id": request_entry.resource_id
            }, status=201)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid method"}, status=405)