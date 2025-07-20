# views.py
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.db.models import Count, Q
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
import json

from login_manager.models import User
from system_layout.models import LayoutItem, Lab
from .models import LabAssignmentSetting

class UserPrivilegesView(TemplateView):
    """Main template view for user privileges management"""
    template_name = 'userprivileges/userprivileges.html'
    
    @method_decorator(login_required)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)


@login_required
def stats_api(request):
    """API endpoint for dashboard statistics"""
    total_users = User.objects.count()
    unassigned_users = User.objects.filter(role='No Roles').count()
    total_labs = Lab.objects.count()
    
    labs_without_instructor = Lab.objects.filter(instructors__isnull=True).count()
    labs_without_assistant = Lab.objects.filter(assistants__isnull=True).count()
    
    return JsonResponse({
        'total_users': total_users,
        'unassigned_users': unassigned_users,
        'total_labs': total_labs,
        'labs_without_instructor': labs_without_instructor,
        'labs_without_assistant': labs_without_assistant
    })


@login_required
def buildings_api(request):
    """API endpoint for buildings list"""
    buildings = LayoutItem.objects.filter(
        item_type='building'
    ).annotate(
        floors_count=Count('children', filter=Q(children__item_type='floor'))
    )
    
    buildings_data = []
    for building in buildings:
        buildings_data.append({
            'id': building.id,
            'name': building.name,
            'floors_count': building.floors_count
        })
    
    return JsonResponse(buildings_data, safe=False)


@login_required
def floors_api(request, building_id):
    """API endpoint for floors in a building"""
    building = get_object_or_404(LayoutItem, id=building_id, item_type='building')
    floors = building.children.filter(item_type='floor').annotate(
        labs_count=Count('lab_children')
    )
    
    floors_data = []
    for floor in floors:
        floors_data.append({
            'id': floor.id,
            'name': floor.name,
            'labs_count': floor.labs_count
        })
    
    return JsonResponse(floors_data, safe=False)


@login_required
def labs_api(request, floor_id):
    """API endpoint for labs on a floor"""
    floor = get_object_or_404(LayoutItem, id=floor_id, item_type='floor')
    labs = Lab.objects.filter(parent=floor).prefetch_related('instructors', 'assistants')
    
    labs_data = []
    for lab in labs:
        labs_data.append(lab.to_dict())
    
    return JsonResponse(labs_data, safe=False)


@login_required
def users_api(request):
    """API endpoint for all users"""
    if request.method == 'GET':
        users = User.objects.all()
        users_data = []
        for user in users:
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role
            })
        return JsonResponse(users_data, safe=False)

@csrf_exempt
@require_http_methods(["GET", "POST"])
def capacity_and_dimension_api(request):
    if request.method == 'GET':
        lab_id = request.GET.get('lab_id')
        if not lab_id:
            return JsonResponse({'error': 'lab_id is required'}, status=400)

        try:
            lab = Lab.objects.get(id=lab_id)
            return JsonResponse({
                'capacity': lab.capacity,
                'dimension': lab.dimension,
            })
        except Lab.DoesNotExist:
            return JsonResponse({'error': 'Lab not found'}, status=404)

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            lab_id = data.get('lab_id')
            if not lab_id:
                return JsonResponse({'success': False, 'error': 'lab_id is required'})

            lab = Lab.objects.get(id=lab_id)
            lab.capacity = data.get('capacity', lab.capacity)
            lab.dimension = data.get('dimension', lab.dimension)
            lab.save()

            return JsonResponse({'success': True})
        except Lab.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Lab not found'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

@csrf_exempt
@login_required
def user_detail_api(request, user_id):
    """API endpoint for individual user operations"""
    user = get_object_or_404(User, id=user_id)
    
    if request.method == 'GET':
        return JsonResponse({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role
        })
    
    elif request.method == 'PUT':
        try:
            data = json.loads(request.body)
            user.username = data.get('username', user.username)
            user.email = data.get('email', user.email)
            user.role = data.get('role', user.role)
            user.save()
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    elif request.method == 'DELETE':
        try:
            user.delete()
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})


@login_required
def available_instructors_api(request):
    """API endpoint for available instructors"""
    limits = LabAssignmentSetting.get_current_limits()
    instructors = User.objects.filter(
        Q(role='Lab Incharge') | Q(role='Administrator')
    ).annotate(
        current_labs=Count('instructor_labs')
    )
    
    instructors_data = []
    for instructor in instructors:
        instructors_data.append({
            'id': instructor.id,
            'username': instructor.username,
            'email': instructor.email,
            'current_labs': instructor.current_labs
        })
    
    return JsonResponse(instructors_data, safe=False)


@login_required
def available_assistants_api(request):
    """API endpoint for available assistants"""
    limits = LabAssignmentSetting.get_current_limits()
    assistants = User.objects.filter(
        role='Lab Assistant'
    ).annotate(
        current_labs=Count('assistant_labs')
    )
    
    assistants_data = []
    for assistant in assistants:
        assistants_data.append({
            'id': assistant.id,
            'username': assistant.username,
            'email': assistant.email,
            'current_labs': assistant.current_labs
        })
    
    return JsonResponse(assistants_data, safe=False)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def assign_staff_api(request):
    """API endpoint for assigning staff to labs"""
    try:
        data = json.loads(request.body)
        lab_id = data.get('lab_id')
        user_id = data.get('user_id')
        staff_type = data.get('type')
        
        lab = get_object_or_404(Lab, id=lab_id)
        user = get_object_or_404(User, id=user_id)
        limits = LabAssignmentSetting.get_current_limits()
        
        if staff_type == 'instructor':
            current_labs = user.instructor_labs.count()
            if current_labs >= limits.instructor_limit:
                return JsonResponse({
                    'success': False, 
                    'error': f'Instructor limit ({limits.instructor_limit}) reached'
                })
            lab.instructors.add(user)
        
        elif staff_type == 'assistant':
            current_labs = user.assistant_labs.count()
            if current_labs >= limits.assistant_limit:
                return JsonResponse({
                    'success': False, 
                    'error': f'Assistant limit ({limits.assistant_limit}) reached'
                })
            lab.assistants.add(user)
        
        else:
            return JsonResponse({'success': False, 'error': 'Invalid staff type'})
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def settings_api(request):
    """API endpoint for saving settings"""
    try:
        data = json.loads(request.body)
        instructor_limit = data.get('instructor_limit', 3)
        assistant_limit = data.get('assistant_limit', 5)
        
        limits = LabAssignmentSetting.get_current_limits()
        limits.instructor_limit = instructor_limit
        limits.assistant_limit = assistant_limit
        limits.save()
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def remove_staff_api(request):
    """API endpoint for removing staff from labs"""
    try:
        data = json.loads(request.body)
        lab_id = data.get('lab_id')
        user_id = data.get('user_id')
        staff_type = data.get('type')
        
        lab = get_object_or_404(Lab, id=lab_id)
        user = get_object_or_404(User, id=user_id)
        
        if staff_type == 'instructor':
            lab.instructors.remove(user)
        elif staff_type == 'assistant':
            lab.assistants.remove(user)
        else:
            return JsonResponse({'success': False, 'error': 'Invalid staff type'})
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})