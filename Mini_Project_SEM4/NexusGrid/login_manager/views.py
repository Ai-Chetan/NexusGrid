from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.core.mail import send_mail
from django.conf import settings
import random

def landing_page(request):
    return render(request, 'login_manager/landing-page.html')

def login_page(request):
    if request.method == 'POST':
        print(request.POST)
        if "get_otp" in request.POST:
            email = request.POST.get('email')  # Get email from form input
            return get_otp(request, email)  # Return the response from get_otp()

    return render(request, 'login_manager/signin-signup-page.html')

def get_otp(request, email):
    otp = random.randint(1000, 9999)
    request.session['otp'] = otp  # Store OTP in session

    print(f"Sending email to: {email}")
    print(f"OTP: {otp}")

    try:
        response = send_mail(
            'Your OTP for Verification',
            f'Your OTP is {otp}. Please do not share it with anyone.',
            settings.EMAIL_HOST_USER,
            [email],
            fail_silently=False,
        )
        
        if response == 1:
            print("✅ Email sent successfully")
            return JsonResponse({'status': 'success', 'message': 'OTP sent successfully!'})
        else:
            print("❌ Email sending failed")
            return JsonResponse({'status': 'error', 'message': 'Email sending failed!'})

    except Exception as e:
        print(f"🚨 Error sending email: {e}")
        return JsonResponse({'status': 'error', 'message': str(e)})

