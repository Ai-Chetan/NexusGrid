from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.db import transaction
import json
from .models import LayoutItem

def layout_view(request, item_id=None):
    if item_id:
        current_item = get_object_or_404(LayoutItem, id=item_id)
        parent = current_item
        
        # Get ancestors for breadcrumb
        breadcrumb = [{'id': ancestor.id, 'name': ancestor.name} for ancestor in parent.get_ancestors()]
            
    else:
        current_item = None
        parent = None
        breadcrumb = []
        
    context = {
        'parent': parent,
        'breadcrumb': breadcrumb,
        'parent_id': parent.id if parent else None,
    }
    
    return render(request, 'system-layout/system-layout.html', context)

def get_layout_items(request):
    parent_id = request.GET.get('parent_id')
    
    if parent_id and parent_id != 'null':
        items = LayoutItem.objects.filter(parent_id=parent_id)
    else:
        items = LayoutItem.objects.filter(parent__isnull=True)
    
    items_data = [item.to_dict() for item in items]
    
    return JsonResponse({'items': items_data})

def get_parent(request):
    item_id = request.GET.get('item_id')
    try:
        item = get_object_or_404(LayoutItem, id=item_id)
        parent_id = item.parent.id if item.parent else None
        return JsonResponse({'parent_id': parent_id})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
def add_layout_item(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)
    
    try:
        data = json.loads(request.body)
        
        parent_id = data.get('parent_id')
        parent = None
        if parent_id and parent_id != 'null':
            parent = get_object_or_404(LayoutItem, id=parent_id)
        
        item = LayoutItem.objects.create(
            name=data.get('name'),
            item_type=data.get('item_type'),
            parent=parent,
            position_x=data.get('position_x', 0),
            position_y=data.get('position_y', 0),
            width=data.get('width', 1),
            height=data.get('height', 1)
        )
        
        return JsonResponse({
            'status': 'success',
            'item': item.to_dict()
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
def update_layout_item(request, item_id):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)
    
    try:
        item = get_object_or_404(LayoutItem, id=item_id)
        data = json.loads(request.body)
        
        # Update only provided fields
        for field in ['name', 'position_x', 'position_y']:
            if field in data:
                setattr(item, field, data[field])
            
        item.save()
        
        return JsonResponse({
            'status': 'success',
            'item': item.to_dict()
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
def delete_layout_item(request, item_id):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)
    
    try:
        item = get_object_or_404(LayoutItem, id=item_id)
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
        
        # Use transaction to ensure all updates happen or none
        with transaction.atomic():
            for item_data in items:
                item_id = item_data.get('id')
                item = get_object_or_404(LayoutItem, id=item_id)
                
                item.position_x = item_data.get('position_x', item.position_x)
                item.position_y = item_data.get('position_y', item.position_y)
                item.save()
        
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)