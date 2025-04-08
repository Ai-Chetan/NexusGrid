from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth.models import User
from django.contrib.auth import get_user_model
from django.conf import settings
import json
from system_layout.models import Lab

# Helper function to check if user is admin
def is_admin(user):
    return user.is_superuser or user.is_staff

# Main admin view for lab privileges
@user_passes_test(is_admin)
def admin_lab_privileges(request):
    # Get all labs
    labs = Lab.objects.all().prefetch_related('instructors', 'assistants')
    
    # Get available users who can be instructors or assistants
    User = get_user_model()
    available_instructors = User.objects.all()
    available_assistants = User.objects.all()
    
    # Get max labs per assistant setting (default: 5)
    max_labs_per_assistant = getattr(settings, 'MAX_LABS_PER_ASSISTANT', 5)
    
    context = {
        'labs': labs,
        'available_instructors': available_instructors,
        'available_assistants': available_assistants,
        'max_labs_per_assistant': max_labs_per_assistant,
    }
    
    return render(request, 'userprivileges/userprivileges.html', context)

# Add a new lab
@user_passes_test(is_admin)
@require_POST
def add_lab(request):
    lab_name = request.POST.get('lab_name')
    location = request.POST.get('location')
    capacity = request.POST.get('capacity')
    dimension = request.POST.get('dimension')
    
    # Create new lab
    try:
        lab = Lab.objects.create(
            lab_name=lab_name,
            location=location,
            capacity=capacity if capacity else None,
            dimension=dimension
        )
        return redirect('userprivileges')
    except Exception as e:
        # Handle errors (e.g., duplicate lab name)
        return render(request, 'userprivileges/userprivileges.html', {
            'error': f"Failed to create lab: {str(e)}",
            'labs': Lab.objects.all().prefetch_related('instructors', 'assistants'),
        })

# Delete a lab
@user_passes_test(is_admin)
@require_POST
def delete_lab(request):
    lab_name = request.POST.get('lab_name')
    lab = get_object_or_404(Lab, lab_name=lab_name)
    lab.delete()
    return redirect('userprivileges')

# Add a lab incharge
@user_passes_test(is_admin)
@require_POST
def add_lab_incharge(request):
    lab_name = request.POST.get('lab_name')
    instructor_id = request.POST.get('instructor_id')
    new_email = request.POST.get('new_email')
    new_name = request.POST.get('new_name')
    
    lab = get_object_or_404(Lab, lab_name=lab_name)
    
    try:
        # If we're adding an existing user
        if instructor_id:
            user = get_object_or_404(User, id=instructor_id)
            lab.instructors.add(user)
        # If we're creating a new user
        elif new_email:
            # Split the name into first and last name
            name_parts = new_name.split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            # Create user with a random password, they can reset it later
            user = User.objects.create_user(
                username=new_email.split('@')[0],
                email=new_email,
                password=User.objects.make_random_password(),
                first_name=first_name,
                last_name=last_name
            )
            lab.instructors.add(user)
            
            # Here you would typically send an email to the user with password reset instructions
            
        return redirect('admin_lab_privileuserprivilegesges')
        
    except Exception as e:
        return render(request, 'userprivileges/userprivileges.html', {
            'error': f"Failed to add incharge: {str(e)}",
            'labs': Lab.objects.all().prefetch_related('instructors', 'assistants'),
        })

# Add a lab assistant
@user_passes_test(is_admin)
@require_POST
def add_lab_assistant(request):
    lab_name = request.POST.get('lab_name')
    assistant_id = request.POST.get('assistant_id')
    new_email = request.POST.get('new_email')
    new_name = request.POST.get('new_name')
    
    lab = get_object_or_404(Lab, lab_name=lab_name)
    
    # Get max labs per assistant setting
    max_labs = getattr(settings, 'MAX_LABS_PER_ASSISTANT', 5)
    
    try:
        # If we're adding an existing user
        if assistant_id:
            user = get_object_or_404(User, id=assistant_id)
            
            # Check if user has reached the maximum number of labs
            if user.assisted_labs.count() >= max_labs:
                return render(request, 'userprivileges/userprivileges.html', {
                    'error': f"User has reached the maximum number of assigned labs ({max_labs}).",
                    'labs': Lab.objects.all().prefetch_related('instructors', 'assistants'),
                })
                
            lab.assistants.add(user)
            
        # If we're creating a new user
        elif new_email:
            # Split the name into first and last name
            name_parts = new_name.split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            # Create user with a random password, they can reset it later
            user = User.objects.create_user(
                username=new_email.split('@')[0],
                email=new_email,
                password=User.objects.make_random_password(),
                first_name=first_name,
                last_name=last_name
            )
            lab.assistants.add(user)
            
            # Here you would typically send an email to the user with password reset instructions
            
        return redirect('userprivileges')
        
    except Exception as e:
        return render(request, 'userprivileges/userprivileges.html', {
            'error': f"Failed to add assistant: {str(e)}",
            'labs': Lab.objects.all().prefetch_related('instructors', 'assistants'),
        })

# Remove a member from a lab
@user_passes_test(is_admin)
@require_POST
def remove_lab_member(request):
    data = json.loads(request.body)
    lab_name = data.get('lab_name')
    user_id = data.get('user_id')
    role = data.get('role')
    
    try:
        lab = get_object_or_404(Lab, lab_name=lab_name)
        user = get_object_or_404(User, id=user_id)
        
        if role == 'instructor':
            lab.instructors.remove(user)
        elif role == 'assistant':
            lab.assistants.remove(user)
            
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# Add a new member
@user_passes_test(is_admin)
@require_POST
def add_member(request):
    data = json.loads(request.body)
    email = data.get('email')
    name = data.get('name')
    role = data.get('role')
    
    try:
        # Check if user with this email already exists
        User = get_user_model()
        existing_user = User.objects.filter(email=email).first()
        
        if existing_user:
            return JsonResponse({
                'success': False, 
                'error': f'User with email {email} already exists.'
            })
        
        # Split the name into first and last name
        name_parts = name.split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''
        
        # Create the user
        user = User.objects.create_user(
            username=email.split('@')[0],
            email=email,
            password=User.objects.make_random_password(),
            first_name=first_name,
            last_name=last_name
        )
        
        # Set additional permissions based on role
        if role == 'admin':
            user.is_staff = True
            user.save()
        
        # Here you would typically send an email to the user with password reset instructions
        
        return JsonResponse({'success': True, 'user_id': user.id})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# Update global settings
@user_passes_test(is_admin)
@require_POST
def update_settings(request):
    data = json.loads(request.body)
    max_labs = data.get('max_labs_per_assistant')
    
    try:
        # In a real application, you would update this in your database
        # For simplicity, we're using Django settings
        # This is not persistent across app restarts, you'd need to store this in a database
        settings.MAX_LABS_PER_ASSISTANT = int(max_labs)
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})