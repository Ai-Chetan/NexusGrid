from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import LayoutItem
import json

def layout_view(request, parent_id=None):
    """Main view for the layout system"""
    # Get breadcrumb data
    breadcrumb = []
    current_parent = None
    
    if parent_id:
        current_parent = get_object_or_404(LayoutItem, id=parent_id)
        temp_parent = current_parent
        
        # Build the breadcrumb trail
        while temp_parent:
            breadcrumb.insert(0, temp_parent)
            temp_parent = temp_parent.parent
    
    context = {
        'parent_id': parent_id,
        'breadcrumb': breadcrumb,
        'parent': current_parent,
    }
    
    return render(request, "system-layout/system-layout.html", context)  # Corrected template path

@csrf_exempt
def get_layout_items(request):
    """Get all layout items for a given parent"""
    parent_id = request.GET.get('parent_id', None)
    
    # Handle "root" case properly
    if parent_id == "root":
        items = LayoutItem.objects.filter(parent=None)  # Assuming root items have no parent
    else:
        try:
            parent_id = int(parent_id) if parent_id is not None else None
            items = LayoutItem.objects.filter(parent_id=parent_id)
        except ValueError:
            return JsonResponse({"error": "Invalid parent_id"}, status=400)
    
    items_data = list(items.values('id', 'name', 'item_type', 'x_position', 'y_position'))
    
    # Add image paths based on item type
    for item in items_data:
        item['image'] = f"system_layout/images/{item['item_type']}.png"
    
    return JsonResponse(items_data, safe=False)  # Changed to match JS expectation

@csrf_exempt
def add_layout_item(request):
    """Add a new layout item"""
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            name = data.get('name', f"New {data.get('item_type', 'Item')}")
            item_type = data.get('item_type')
            x_position = data.get('x_position', 50)
            y_position = data.get('y_position', 50)
            parent_id = data.get('parent_id')
            
            # Create the new item
            item = LayoutItem.objects.create(
                name=name,
                item_type=item_type,
                x_position=x_position,
                y_position=y_position,
                parent_id=parent_id
            )
            
            return JsonResponse({
                'id': item.id,
                'name': item.name,
                'item_type': item.item_type,
                'x_position': item.x_position,
                'y_position': item.y_position,
                'image': f"system_layout/images/{item.item_type}.png"
            }, status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Invalid request'}, status=400)

@csrf_exempt
def update_layout_item(request, item_id):
    """Update a layout item's position or name"""
    item = get_object_or_404(LayoutItem, id=item_id)
    
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            
            # Update position if provided
            if 'x_position' in data and 'y_position' in data:
                item.x_position = data.get('x_position')
                item.y_position = data.get('y_position')
            
            # Update name if provided
            if 'name' in data:
                item.name = data.get('name')
            
            item.save()
            
            return JsonResponse({
                'id': item.id,
                'name': item.name,
                'item_type': item.item_type,
                'x_position': item.x_position,
                'y_position': item.y_position
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Invalid request'}, status=400)

@csrf_exempt
def delete_layout_item(request, item_id):
    """Delete a layout item"""
    if request.method == "DELETE":
        item = get_object_or_404(LayoutItem, id=item_id)
        item.delete()
        return JsonResponse({'status': 'deleted', 'id': item_id})
    
    return JsonResponse({'error': 'Invalid request'}, status=400)

@csrf_exempt
def save_layout(request):
    """Save the entire layout"""
    if request.method != "POST":
        return JsonResponse({'error': 'Invalid request method'}, status=400)

    try:
        data = json.loads(request.body)
        items = data.get('items', [])
        parent_id = data.get('layout_id')

        print("Received data:", data)  # Debugging

        if not parent_id:
            return JsonResponse({'error': 'Missing layout_id'}, status=400)

        # Reset layout if requested
        if data.get('reset', False):
            LayoutItem.objects.filter(parent_id=parent_id).delete()

        # Process layout items
        for item_data in items:
            item_id = item_data.get('id')
            item_name = item_data.get('name', '').strip()
            item_type = item_data.get('item_type', '').strip()

            # Validate required fields
            if not item_name or not item_type:
                return JsonResponse({'error': 'Missing name or item_type'}, status=400)

            if item_id:  # Updating existing item
                item, created = LayoutItem.objects.get_or_create(
                    id=item_id,
                    defaults={
                        'name': item_name,
                        'item_type': item_type,
                        'x_position': item_data.get('x_position', 0),
                        'y_position': item_data.get('y_position', 0),
                        'parent_id': parent_id
                    }
                )

                if created:
                    print(f"✅ Created missing item with ID {item_id}")
                else:
                    # Update existing item
                    item.x_position = item_data.get('x_position', item.x_position)
                    item.y_position = item_data.get('y_position', item.y_position)
                    item.name = item_name
                    item.save()
                    print(f"✅ Updated item: {item_id} - {item.name}")

            else:  # Creating a new item
                new_item = LayoutItem.objects.create(
                    name=item_name,
                    item_type=item_type,
                    x_position=item_data.get('x_position', 0),
                    y_position=item_data.get('y_position', 0),
                    parent_id=parent_id
                )
                print(f"✅ Created new item: {new_item.id} - {new_item.name}")

        return JsonResponse({'status': 'success'})

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON format'}, status=400)
    except Exception as e:
        print(f"Unexpected error: {e}")
        return JsonResponse({'error': 'Internal server error'}, status=500)

def item_detail(request, id):
    item = get_object_or_404(LayoutItem, id=id)
    
    # Get child items if any (for buildings, floors)
    children = LayoutItem.objects.filter(parent_id=id).order_by('name')
    
    context = {
        'item': item,
        'children': children,
        'parent_id': id
    }
    
    # Load the appropriate template based on item type
    template_name = f'layout/{item.item_type}_detail.html'
    
    return render(request, template_name, context)