# system_layout/views.py
# All Django-template views removed. The system_layout app is now data-only:
# models, migrations, and admin registration are preserved.
# All layout API endpoints are served via api_v1/.

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

    # Get lab from parent room via OneToOne accessor
    lab = None
    if parent and parent.item_type == 'room':
        lab = getattr(parent, 'lab', None)

    base_qs = System.objects.filter(lab=lab) if lab else System.objects.none()

    counts = base_qs.aggregate(
        total=Count('id'),
        functional=Count(Case(When(status__in=['active', 'inactive'], then=1), output_field=IntegerField())),
        critical=Count(Case(When(status='non-functional', then=1), output_field=IntegerField())),
        active=Count(Case(When(status='active', then=1), output_field=IntegerField())),
    )
    total_systems = counts['total']
    functional_count = counts['functional']
    critical_count = counts['critical']
    active_count = counts['active']

    if total_systems > 0:
        functional_percent = round((functional_count / total_systems) * 100, 1)
        critical_percent = round((critical_count / total_systems) * 100, 1)
        active_percent = round((active_count / total_systems) * 100, 1)
        system_utilization = round((active_count / (functional_count or 1)) * 100, 1)
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

@login_required(login_url="/login/")
def get_layout_items(request):
    parent_id = request.GET.get('parent_id')
    parent_id = int(parent_id) if parent_id and parent_id.isdigit() else None

    system_types = ['computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack']

    # Use select_related to avoid N+1 queries for system and lab lookups
    qs = LayoutItem.objects.select_related('system', 'lab')
    items = qs.filter(parent_id=parent_id) if parent_id else qs.filter(parent__isnull=True)

    item_list = []
    for item in items:
        item_dict = item.to_dict()

        if item.item_type in system_types:
            # getattr with default works because RelatedObjectDoesNotExist is an AttributeError subclass
            system = getattr(item, 'system', None)
            item_dict['status'] = system.status if system else None
        else:
            item_dict['status'] = None

        if item.item_type == 'room':
            lab = getattr(item, 'lab', None)
            item_dict['quick_info'] = lab.get_quick_info() if lab else {}

        item_list.append(item_dict)

    return JsonResponse({'items': item_list})

@login_required(login_url="/login/")
def get_parent(request):
    item_id = request.GET.get('item_id')
    try:
        item = get_object_or_404(LayoutItem, id=int(item_id))
        return JsonResponse({'parent_id': item.parent.id if item.parent else None})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
@login_required(login_url="/login/")
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
                    parent_lab = getattr(ancestor, 'lab', None)
                    if parent_lab:
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
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
@login_required(login_url="/login/")
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
        if item.item_type == 'room' and name_changed:
            lab = getattr(item, 'lab', None)
            if lab:
                lab.lab_name = item.name
                lab.save(update_fields=['lab_name'])

        # Update System host_name and metadata if it's a system item
        if item.item_type in ['computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack']:
            system = getattr(item, 'system', None)
            if system:
                system.host_name = item.name
                system.updated_at = timezone.now()
                system.updated_by_id = request.user.id
                system.save(update_fields=['host_name', 'updated_at', 'updated_by_id'])

        return JsonResponse({'status': 'success', 'item': item.to_dict()})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
@login_required(login_url="/login/")
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
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
@login_required(login_url="/login/")
def save_layout(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)
    
    try:
        data = json.loads(request.body)
        items = data.get('items', [])
        
        ids = [int(d['id']) for d in items if d.get('id')]
        items_by_id = {obj.id: obj for obj in LayoutItem.objects.filter(id__in=ids)}
        to_update = []
        for item_data in items:
            obj = items_by_id.get(int(item_data['id']))
            if obj:
                obj.position_x = item_data.get('position_x', obj.position_x)
                obj.position_y = item_data.get('position_y', obj.position_y)
                to_update.append(obj)
        with transaction.atomic():
            LayoutItem.objects.bulk_update(to_update, ['position_x', 'position_y'])
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

# Fault and resource submission endpoints removed from this module.
# Use the canonical endpoints in /faults/create/ and /resources/create/ instead.