from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.conf import settings
import random
from Python_Files import *
from NexusGrid.models import User as CustomUser
import bcrypt # type: ignore

def user_signup(request):
    otp_storage = {}
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm-password')
        role = request.POST.get('role')
        entered_otp = request.POST.get('otp')

        if password != confirm_password:
            messages.error(request, "Passwords do not match.")
            return redirect('signin-signup-page.html')

        if CustomUser.objects.filter(username=username).exists():
            messages.error(request, "Username already exists.")
            return redirect('signin-signup-page.html')
        if CustomUser.objects.filter(email=email).exists():
            messages.error(request, "Email already exists.")
            return redirect('signin-signup-page.html')

        # Handle OTP verification
        if email in otp_storage and entered_otp:
            if otp_storage[email] == entered_otp:
                hashed_password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
                new_user = CustomUser(username=username, password=hashed_password, role=role)
                new_user.save()
                del otp_storage[email]
                messages.success(request, "Registration successful! Please log in.")
                return redirect('signin-signup-page.html')
            else:
                messages.error(request, "Invalid OTP. Please try again.")
                return redirect('signin-signup-page.html')
        else:
            otp = str(random.randint(100000, 999999))
            otp_storage[email] = otp
            send_mail(
                subject="Your NexusGrid Signup OTP",
                message=f"Your OTP for NexusGrid signup is: {otp}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
            messages.info(request, "OTP sent to your email. Please enter it to complete signup.")
            return render(request, 'signup.html', {"email": email, "otp_sent": True})