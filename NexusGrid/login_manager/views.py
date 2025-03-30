from django.shortcuts import render,redirect
from django.contrib.auth import authenticate, login
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.utils.timezone import now
from datetime import datetime, timedelta
from django.contrib.auth.hashers import make_password
from NexusGrid import settings
from login_manager.models import User
import random
import json

from NexusGrid.settings import EMAIL_HOST_USER
from.models import *

def landing_page(request):
    return render(request, 'login_manager/signin-signup-page.html')

def login_page(request):
    return render(request,'login_manager/landing-page.html' )

def user_login(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)  # Parse JSON
            username = data.get("username")
            password = data.get("password")

            user = authenticate(request, username=username, password=password)

            if user is not None:
                login(request, user)

                # Fetch role correctly
                user_role = getattr(user, "role", None)  # Avoids AttributeError if role does not exist
                
                if user_role is None:
                    return JsonResponse({"success": False, "message": "User role not found"})

                # Correct session storage
                request.session["user_role"] = user_role

                return JsonResponse({"success": True, "redirect_url": "/dashboard/", "role": user_role})
            else:
                return JsonResponse({"success": False, "message": "Invalid username or password"})

        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON data"})

    return JsonResponse({"success": False, "message": "Only POST requests are allowed"})

def get_otp(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username")
            email = data.get("email")
            password = data.get("password")

            if not email or not username or not password:
                return JsonResponse({"success": False, "message": "All fields are required"}, status=400)

            # Check if the email is already registered
            if User.objects.filter(email=email).exists():
                return JsonResponse({"success": False, "message": "Email is already registered"}, status=400)

            # Generate a 6-digit OTP
            otp = random.randint(100000, 999999)

            # Store OTP and user details in session
            request.session["otp"] = str(otp)  # Convert OTP to string for comparison
            request.session["otp_email"] = email
            request.session["otp_username"] = username
            request.session["otp_password"] = make_password(password)  # Store hashed password
            request.session["otp_expiry"] = (datetime.now() + timedelta(minutes=5)).timestamp()  # Expiry time

            # Send OTP via email
            subject = 'Account Verification Code – NexusGrid'
            message = f"""Thank you for signing up with NexusGrid.
To complete your account verification, please use the One-Time Password (OTP) below:

Your OTP: {otp}

This OTP is valid for 5 minutes. Please do not share this code with anyone.
If you did not request this verification, please ignore this email or contact our support team.

Best regards,
NexusGrid Team"""

            send_mail(subject, message, settings.EMAIL_HOST_USER, [email])

            return JsonResponse({"success": True, "message": "OTP sent successfully"})

        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON data"}, status=400)

    return JsonResponse({"success": False, "message": "Invalid request method"}, status=405)


def verify_otp(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            entered_otp = str(data.get("otp"))  # Convert to string for comparison

            # Retrieve stored OTP and user data from session
            stored_otp = request.session.get("otp")
            username = request.session.get("otp_username")
            email = request.session.get("otp_email")
            password = request.session.get("otp_password")  # Hashed password
            otp_expiry = request.session.get("otp_expiry")

            if not stored_otp or not email or not username or not password:
                return JsonResponse({"success": False, "message": "OTP expired. Please request a new one."}, status=400)

            # Check if OTP has expired
            if otp_expiry and datetime.now().timestamp() > otp_expiry:
                request.session.flush()  # Clear session data
                return JsonResponse({"success": False, "message": "OTP expired. Please request a new one."}, status=400)

            # Verify OTP
            if entered_otp == stored_otp:
                # Clear OTP from session after successful verification
                request.session.flush()

                # Save user details in the database
                new_user = User.objects.create(
                    username=username,
                    email=email,
                    password=password  # Already hashed password
                )

                return JsonResponse({"success": True, "message": "OTP Verified! User registered successfully."})

            return JsonResponse({"success": False, "message": "Invalid OTP. Try again."}, status=400)

        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid request data"}, status=400)

    return JsonResponse({"success": False, "message": "Invalid request method"}, status=405)

def handle_signup(request):
    username = request.POST.get('username')
    email = request.POST.get('email')
    password = request.POST.get('password')
    confirm_password = request.POST.get('confirm-password')
   ## role = request.POST.get('role')

    if password != confirm_password:
        messages.error(request, 'Passwords do not match.')
        return redirect('login_manager/signin-signup-page.html')

    if User.objects.filter(username=username).exists():
        messages.error(request, 'Username already taken.')
        return redirect('login_manager/signin-signup-page.html')

    user = User.objects.create_user(username=username, email=email, password=password, role="default_user")
    messages.success(request, 'Account created successfully. Please log in.')
    return redirect('login_manager/signin-signup-page.html')