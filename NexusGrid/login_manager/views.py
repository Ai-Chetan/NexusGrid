from django.shortcuts import render
from django.contrib.auth import authenticate, login
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.utils.timezone import now
from datetime import timedelta
import random
import json

# Create your views here.
def landing_page(request):
    return render(request, 'login_manager/signin-signup-page.html')

def login_page(request):
    return render(request,'login_manager/landing-page.html' )

def user_login(request):
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect("dashboard")  # Redirect to dashboard after login
        else:
            messages.error(request, "Invalid username or password")

    return render(request, "login_manager/login.html")

def get_otp(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")

            if not email:
                return JsonResponse({"success": False, "message": "Email is required"}, status=400)

            # Generate a 6-digit OTP
            otp = random.randint(100000, 999999)

            # Store OTP in session for verification
            request.session["otp"] = otp
            request.session["otp_email"] = email
            request.session["otp_expiry"] = (now() + timedelta(minutes=5)).timestamp()  # Expires in 5 mins

            # Send OTP via email
            subject = "Your OTP Code"
            message = f"Your OTP code is {otp}. It is valid for 5 minutes."
            from_email = "your-email@gmail.com"  # Use the email configured in settings
            recipient_list = [email]

            send_mail(subject, message, from_email, recipient_list)

            return JsonResponse({"success": True, "message": "OTP sent successfully"})

        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON data"}, status=400)

    return JsonResponse({"success": False, "message": "Invalid request method"}, status=405)

def verify_otp(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            entered_otp = data.get("otp")

            # Retrieve stored OTP from session
            stored_otp = request.session.get("otp")

            if not stored_otp:
                return JsonResponse({"success": False, "message": "OTP expired. Please request a new one."}, status=400)

            if str(entered_otp) == str(stored_otp):  # Convert to string for comparison
                # Clear OTP from session after successful verification
                del request.session["otp"]
                del request.session["otp_email"]

                return JsonResponse({"success": True, "message": "OTP Verified!"})
            else:
                return JsonResponse({"success": False, "message": "Invalid OTP. Try again."}, status=400)

        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid request data"}, status=400)

    return JsonResponse({"success": False, "message": "Invalid request method"}, status=405)