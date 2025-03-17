from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login
from django.contrib import messages
from django.core.mail import send_mail
from django.utils.crypto import get_random_string
#from .models import CustomUser  # Assuming you have a CustomUser model
from django.http import JsonResponse
from NexusGrid.settings import EMAIL_HOST_USER


# Store OTPs in session temporarily

def landing_page(request):
    return render(request, 'login_manager/landing-page.html')

def login_page(request):
    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'login':
            username = request.POST.get('username')
            password = request.POST.get('password')
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                return redirect('login_manager/signin-signup-page.html')
            else:
                messages.error(request, 'Invalid username or password.')

        elif action == 'get_otp':
            email = request.POST.get('email')
            otp = get_random_string(6, '0123456789')
            request.session['otp'] = otp
            request.session['otp_email'] = email

            send_mail(
                'Your NexusGrid OTP',
                f'Your OTP is: {otp}',
                EMAIL_HOST_USER,
                [email],
                fail_silently=False,
            )
            return JsonResponse({'status': 'OTP sent'})

        elif action == 'validate_otp':
            entered_otp = request.POST.get('otp')
            if entered_otp == request.session.get('otp'):
                request.session['otp_verified'] = True
                return JsonResponse({'status': 'OTP verified'})
            else:
                return JsonResponse({'status': 'Invalid OTP'})

        elif action == 'signup':
            if not request.session.get('otp_verified'):
                messages.error(request, 'Please verify your email before signing up.')
                return redirect('login_manager/signin-signup-page.html')

            username = request.POST.get('username')
            email = request.POST.get('email')
            password = request.POST.get('password')
            confirm_password = request.POST.get('confirm-password')
            role = request.POST.get('role')

            if password != confirm_password:
                messages.error(request, 'Passwords do not match.')
                return redirect('login_manager/signin-signup-page.html')

            # if CustomUser.objects.filter(username=username).exists():
            #     messages.error(request, 'Username already taken.')
            #     return redirect('login_signup')

            #user = CustomUser.objects.create_user(username=username, email=email, password=password, role=role)
            messages.success(request, 'Account created successfully. Please log in.')
            del request.session['otp_verified']
            return redirect('login_manager/signin-signup-page.html')

    return render(request, 'login_manager/signin-signup-page.html')

# Suggested Changes:
# - Use Django Forms for better form handling and validation.
# - Implement frontend JavaScript for seamless OTP flow without page reload.
# - Improve error handling and UI feedback for a smoother experience.
