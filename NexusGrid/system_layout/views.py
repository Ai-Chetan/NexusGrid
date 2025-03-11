from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
from django.views.decorators.http import require_http_methods
from django.db import transaction
from django.db.models import Prefetch
from .models import LayoutItem, ComputerDetails, ServerDetails, NetworkDeviceDetails
import json
import logging

logger = logging.getLogger(__name__)

def layout_view(request, parent_id=None):
    """Main view for the layout system"""
    # Get breadcrumb data
    breadcrumb = []
    current_parent = None
    
    if parent_id:
        # Get parent item with a single database query
        current_parent = get_object_or_404(LayoutItem, id=parent_id)
        
        # Get ancestors with a single query rather than recursively
        breadcrumb = current_parent.get_ancestors() + [current_parent]
    
    context = {
        'parent_id': parent_id,
        'breadcrumb': breadcrumb,
        'parent': current_parent,
    }
    
    return render(request, "system-layout/system-layout.html", context)

@require_http_methods(["GET"])
def get_layout_items(request):
    """Get all layout items for a given parent with lazy loading"""
    parent_id = request.GET.get('parent_id', None)
    
    # Use the cached method from the model for better performance
    if parent_id == "root":
        items_data = LayoutItem.get_children(None)
    else:
        try:
            parent_id = int(parent_id) if parent_id is not None else None
            items_data = LayoutItem.get_children(parent_id)
        except ValueError:
            return JsonResponse({"error": "Invalid parent_id"}, status=400)
    
    # Add image paths based on item type
    for item in items_data:
        item['image'] = f"system_layout/images/{item['item_type']}.png"
    
    return JsonResponse(items_data, safe=False)

@csrf_exempt
@require_http_methods(["POST"])
def add_layout_item(request):
    """Add a new layout item"""
    try:
        data = json.loads(request.body)
        name = data.get('name', f"New {data.get('item_type', 'Item')}")
        item_type = data.get('item_type')
        x_position = data.get('x_position', 50)
        y_position = data.get('y_position', 50)
        parent_id = data.get('parent_id')
        
        # Validate parent-child relationship
        if parent_id:
            parent = get_object_or_404(LayoutItem, id=parent_id)
            valid_child_types = LayoutItem.VALID_PARENT_CHILD_RELATIONSHIPS.get(parent.item_type, [])
            if item_type not in valid_child_types:
                return JsonResponse({
                    'error': f"{parent.item_type} cannot contain {item_type}. Valid types: {', '.join(valid_child_types)}"
                }, status=400)
        
        # Create the new item
        with transaction.atomic():
            item = LayoutItem.objects.create(
                name=name,
                item_type=item_type,
                x_position=x_position,
                y_position=y_position,
                parent_id=parent_id
            )
            
            # Clear parent's cache
            if parent_id:
                cache_key = f'layout_children_{parent_id}'
                cache.delete(cache_key)
        
        return JsonResponse({
            'id': item.id,
            'name': item.name,
            'item_type': item.item_type,
            'x_position': item.x_position,
            'y_position': item.y_position,
            'slug': item.slug,
            'image': f"system_layout/images/{item.item_type}.png"
        }, status=201)
    except Exception as e:
        logger.exception(f"Error adding layout item: {str(e)}")
        return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def update_layout_item(request, item_id):
    """Update a layout item's position or name"""
    try:
        item = get_object_or_404(LayoutItem, id=item_id)
        data = json.loads(request.body)
        
        with transaction.atomic():
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
            'y_position': item.y_position,
            'slug': item.slug
        })
    except Exception as e:
        logger.exception(f"Error updating layout item {item_id}: {str(e)}")
        return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_layout_item(request, item_id):
    """Delete a layout item"""
    try:
        item = get_object_or_404(LayoutItem, id=item_id)
        parent_id = item.parent_id
        
        with transaction.atomic():
            item.delete()
            
            # Clear parent's cache
            if parent_id:
                cache_key = f'layout_children_{parent_id}'
                cache.delete(cache_key)
        
        return JsonResponse({'status': 'deleted', 'id': item_id})
    except Exception as e:
        logger.exception(f"Error deleting layout item {item_id}: {str(e)}")
        return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def save_layout(request):
    """Save the entire layout with error handling and validation"""
    try:
        data = json.loads(request.body)
        items = data.get('items', [])
        layout_id = data.get('layout_id')
        processed_ids = []
        
        logger.info(f"Received layout data: layout_id={layout_id}, items_count={len(items)}")

        # Handle root case
        if layout_id == "root":
            parent_id = None
        else:
            try:
                parent_id = int(layout_id) if layout_id else None
            except ValueError:
                return JsonResponse({'error': f'Invalid layout_id: {layout_id}'}, status=400)

        # If parent exists, check if it can have children
        if parent_id:
            parent = get_object_or_404(LayoutItem, id=parent_id)
            valid_child_types = LayoutItem.VALID_PARENT_CHILD_RELATIONSHIPS.get(parent.item_type, [])
            if not valid_child_types:
                return JsonResponse({
                    'error': f"{parent.item_type} cannot contain children"
                }, status=400)

        # Process layout items within a transaction for consistency
        with transaction.atomic():
            # First, get all current items for this parent to handle deletions
            if parent_id is None:
                existing_items = list(LayoutItem.objects.filter(parent=None).values_list('id', flat=True))
            else:
                existing_items = list(LayoutItem.objects.filter(parent_id=parent_id).values_list('id', flat=True))
            
            for item_data in items:
                try:
                    item_id = item_data.get('id')
                    item_name = item_data.get('name', '').strip()
                    item_type = item_data.get('item_type', '').strip()
                    x_position = item_data.get('x_position', 0)
                    y_position = item_data.get('y_position', 0)

                    # Validate required fields
                    if not item_name or not item_type:
                        return JsonResponse({
                            'error': f'Missing name or item_type for item {item_id}',
                            'item_data': item_data
                        }, status=400)

                    # Validate item type if parent exists
                    if parent_id and item_type not in valid_child_types:
                        return JsonResponse({
                            'error': f"{parent.item_type} cannot contain {item_type}. Valid types: {', '.join(valid_child_types)}",
                            'item_data': item_data
                        }, status=400)

                    if item_id:  # Update existing item
                        try:
                            item = LayoutItem.objects.get(id=item_id)
                            item.name = item_name
                            item.x_position = x_position
                            item.y_position = y_position
                            # Don't change item_type for existing items as it would break hierarchy
                            item.save()
                            processed_ids.append(item_id)
                            logger.info(f"Updated item: {item_id} - {item.name}")
                        except LayoutItem.DoesNotExist:
                            # Create item with specific ID if it doesn't exist
                            item = LayoutItem.objects.create(
                                id=item_id,
                                name=item_name,
                                item_type=item_type,
                                x_position=x_position,
                                y_position=y_position,
                                parent_id=parent_id
                            )
                            processed_ids.append(item_id)
                            logger.info(f"Created item with specific ID: {item_id} - {item.name}")
                    else:  # Create new item
                        item = LayoutItem.objects.create(
                            name=item_name,
                            item_type=item_type,
                            x_position=x_position,
                            y_position=y_position,
                            parent_id=parent_id
                        )
                        processed_ids.append(item.id)
                        logger.info(f"Created new item: {item.id} - {item.name}")
                except Exception as e:
                    logger.exception(f"Error processing item {item_id}: {str(e)}")
                    return JsonResponse({
                        'error': f'Error processing item {item_id}: {str(e)}',
                        'item_data': item_data
                    }, status=500)
            
            # Handle deletions - remove items that were in the database but not in the submitted data
            items_to_delete = set(existing_items) - set(processed_ids)
            if items_to_delete:
                LayoutItem.objects.filter(id__in=items_to_delete).delete()
                logger.info(f"Deleted items: {items_to_delete}")
            
            # Clear cache for this parent
            cache_key = f'layout_children_{parent_id}' if parent_id else 'layout_root_items'
            cache.delete(cache_key)

        return JsonResponse({'status': 'success'})

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON format: {str(e)}")
        return JsonResponse({'error': f'Invalid JSON format: {str(e)}'}, status=400)
    except Exception as e:
        logger.exception(f"Unexpected error in save_layout: {str(e)}")
        return JsonResponse({'error': f'Internal server error: {str(e)}'}, status=500)

def item_detail(request, id):
    """Detail view for a specific item with optimized queries"""
    # Use select_related to get parent in the same query
    item = get_object_or_404(LayoutItem.objects.select_related('parent'), id=id)
    
    # Get appropriate detail model based on item type
    additional_context = {}
    if item.item_type == 'computer' and hasattr(item, 'properties') and isinstance(item.properties, ComputerDetails):
        additional_context['details'] = item.properties
    elif item.item_type == 'server' and hasattr(item, 'properties') and isinstance(item.properties, ServerDetails):
        additional_context['details'] = item.properties
    
    # Get child items if any (for buildings, floors, rooms)
    # Use the cached method for better performance
    children = LayoutItem.get_children(id)
    
    context = {
        'item': item,
        'children': children,
        'parent_id': id,
        'breadcrumb': item.get_ancestors() + [item],
        **additional_context
    }
    
    # Load the appropriate template based on item type
    template_name = f'system-layout/{item.item_type}_detail.html'
    
    # Fallback to generic template if specific one doesn't exist
    try:
        return render(request, template_name, context)
    except:
        return render(request, 'system-layout/generic_detail.html', context)