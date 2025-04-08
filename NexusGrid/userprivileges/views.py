from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import get_user_model
from system_layout.models import Lab
from django.contrib import messages
from django.conf import settings
from django.db.models import Count
from django.views.decorators.http import require_POST

User = get_user_model()
DEFAULT_LAB_LIMIT = getattr(settings, 'LAB_ASSISTANT_MAX_LABS', 5)

def user_privileges(request):
    users = User.objects.exclude(role='No Roles')
    labs = Lab.objects.prefetch_related('instructors', 'assistants')
    return render(request, 'userprivileges/userprivileges.html', {
        'users': users,
        'labs': labs,
        'user_role': request.user.role,
        'default_limit': DEFAULT_LAB_LIMIT
    })


@require_POST
def assign_role(request):
    email = request.POST.get('email')
    role = request.POST.get('role')

    try:
        user = User.objects.get(email=email)
        if user.role != 'No Roles':
            messages.warning(request, f"{user.username} already has the role {user.role}")
        else:
            user.role = role
            user.save()
            messages.success(request, f"Assigned {role} role to {user.username}")
    except User.DoesNotExist:
        messages.error(request, "User with that email does not exist.")

    return redirect('admin_lab_privileges')


@require_POST
def update_lab_assignment(request, lab_name):
    lab = get_object_or_404(Lab, lab_name=lab_name)
    instructor_id = request.POST.get('instructor')  # single instructor
    assistant_id = request.POST.get('assistant')

    if instructor_id:
        instructor = get_object_or_404(User, id=instructor_id)
        lab.instructors.add(instructor)  # add one at a time

    if assistant_id:
        assistant = get_object_or_404(User, id=assistant_id)
        lab_count = assistant.assisted_labs.count()
        if lab_count >= DEFAULT_LAB_LIMIT:
            messages.warning(request, f"{assistant.username} is already assigned to {lab_count} labs.")
        else:
            lab.assistants.add(assistant)

    return redirect('admin_lab_privileges')

@require_POST
def remove_role(request, user_id):
    user = get_object_or_404(User, id=user_id)
    user.role = 'No Roles'
    user.save()
    messages.info(request, f"Removed role from {user.username}")
    return redirect('admin_lab_privileges')

@require_POST
def remove_lab_user(request, lab_name, user_type, user_id):
    lab = get_object_or_404(Lab, lab_name=lab_name)
    user = get_object_or_404(User, id=user_id)

    if user_type == 'instructor':
        lab.instructors.remove(user)
        messages.success(request, f"Removed instructor {user.username} from {lab.lab_name}")
    elif user_type == 'assistant':
        lab.assistants.remove(user)
        messages.success(request, f"Removed assistant {user.username} from {lab.lab_name}")
    else:
        messages.error(request, "Invalid user type.")

    return redirect('admin_lab_privileges')
