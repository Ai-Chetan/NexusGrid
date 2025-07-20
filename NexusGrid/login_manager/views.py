
import json
import logging
from datetime import datetime, timedelta
from django.contrib.auth import authenticate, login
from django.conf import settings
from django.views.decorators.http import require_http_methods
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import render,redirect
from django.contrib import messages
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password
from NexusGrid import settings
from login_manager.models import User
import random
from django.contrib.auth import get_user_model

User = get_user_model()
from NexusGrid.settings import EMAIL_HOST_USER
from.models import *

def landing_page(request):
    return render(request, 'login_manager/signin-signup-page.html')

def login_page(request):
    return render(request,'login_manager/landing-page.html' )

# Configure logging
logger = logging.getLogger(__name__)

class OTPManager:
    """Centralized OTP management class"""
    
    @staticmethod
    def generate_otp():
        """Generate a 6-digit OTP"""
        return f"{random.randint(100000, 999999):06d}"
    
    @staticmethod
    def store_otp_data(request, otp, email, username, password):
        """Store OTP and user data in session with expiry"""
        request.session.update({
            "otp": otp,
            "otp_email": email,
            "otp_username": username,
            "otp_password": make_password(password),
            "otp_expiry": (datetime.now() + timedelta(minutes=5)).timestamp(),
            "otp_attempts": 0
        })
    
    @staticmethod
    def get_otp_data(request):
        """Retrieve OTP data from session"""
        return {
            'otp': request.session.get("otp"),
            'email': request.session.get("otp_email"),
            'username': request.session.get("otp_username"),
            'password': request.session.get("otp_password"),
            'expiry': request.session.get("otp_expiry"),
            'attempts': request.session.get("otp_attempts", 0)
        }
    
    @staticmethod
    def is_otp_expired(expiry_timestamp):
        """Check if OTP has expired"""
        return expiry_timestamp and datetime.now().timestamp() > expiry_timestamp
    
    @staticmethod
    def increment_attempts(request):
        """Increment OTP verification attempts"""
        attempts = request.session.get("otp_attempts", 0) + 1
        request.session["otp_attempts"] = attempts
        return attempts
    
    @staticmethod
    def clear_otp_data(request):
        """Clear OTP data from session"""
        otp_keys = ["otp", "otp_email", "otp_username", "otp_password", "otp_expiry", "otp_attempts"]
        for key in otp_keys:
            request.session.pop(key, None)

def validate_signup_data(username, email, password):
    """Validate signup form data"""
    errors = []
    
    if not username or len(username.strip()) < 3:
        errors.append("Username must be at least 3 characters long")
    
    if not email:
        errors.append("Email is required")
    else:
        try:
            validate_email(email)
        except ValidationError:
            errors.append("Please enter a valid email address")
    
    if not password or len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    
    # Check if username already exists
    if User.objects.filter(username=username).exists():
        errors.append("Username is already taken")
    
    # Check if email already exists
    if User.objects.filter(email=email).exists():
        errors.append("Email is already registered")
    
    return errors

def send_otp_email(email, otp, username):
    """Send OTP via email with better formatting"""
    try:
        subject = 'Account Verification Code – NexusGrid'
        message = f"""Hello {username},

Thank you for signing up with NexusGrid!

To complete your account verification, please use the One-Time Password (OTP) below:

🔐 Your OTP: {otp}

⏰ This OTP is valid for 5 minutes only.
🔒 Please do not share this code with anyone.

If you did not request this verification, please ignore this email or contact our support team immediately.

Best regards,
The NexusGrid Team

---
Need help? Contact us at nexusgrid.assist@gmail.com
"""
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[email],
            fail_silently=False
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {email}: {str(e)}")
        return False

@require_http_methods(["POST"])
def get_otp(request):
    """Handle OTP generation and sending"""
    try:
        # Parse JSON data
        data = json.loads(request.body)
        username = data.get("username", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        
        # Validate input data
        validation_errors = validate_signup_data(username, email, password)
        if validation_errors:
            return JsonResponse({
                "success": False, 
                "message": "; ".join(validation_errors)
            }, status=400)
        
        # Rate limiting - prevent spam requests
        last_otp_request = request.session.get("last_otp_request")
        if last_otp_request:
            time_since_last = datetime.now().timestamp() - last_otp_request
            if time_since_last < 60:  # 1 minute cooldown
                return JsonResponse({
                    "success": False,
                    "message": f"Please wait {60 - int(time_since_last)} seconds before requesting another OTP"
                }, status=429)
        
        # Generate and store OTP
        otp = OTPManager.generate_otp()
        OTPManager.store_otp_data(request, otp, email, username, password)
        
        # Send OTP email
        if send_otp_email(email, otp, username):
            request.session["last_otp_request"] = datetime.now().timestamp()
            logger.info(f"OTP sent successfully to {email}")
            return JsonResponse({
                "success": True,
                "message": "OTP sent successfully to your email"
            })
        else:
            return JsonResponse({
                "success": False,
                "message": "Failed to send OTP. Please try again."
            }, status=500)
            
    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid request data"
        }, status=400)
        
    except Exception as e:
        logger.error(f"Error in get_otp: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": "An unexpected error occurred. Please try again."
        }, status=500)

@require_http_methods(["POST"])
def verify_otp(request):
    """Handle OTP verification and user creation"""
    try:
        # Parse JSON data
        data = json.loads(request.body)
        entered_otp = str(data.get("otp", "")).strip()
        
        if not entered_otp or len(entered_otp) != 6:
            return JsonResponse({
                "success": False,
                "message": "Please enter a valid 6-digit OTP"
            }, status=400)
        
        # Get stored OTP data
        otp_data = OTPManager.get_otp_data(request)
        
        if not all([otp_data['otp'], otp_data['email'], otp_data['username'], otp_data['password']]):
            return JsonResponse({
                "success": False,
                "message": "OTP session expired. Please request a new OTP."
            }, status=400)
        
        # Check if OTP has expired
        if OTPManager.is_otp_expired(otp_data['expiry']):
            OTPManager.clear_otp_data(request)
            return JsonResponse({
                "success": False,
                "message": "OTP has expired. Please request a new one."
            }, status=400)
        
        # Check maximum attempts (prevent brute force)
        if otp_data['attempts'] >= 5:
            OTPManager.clear_otp_data(request)
            return JsonResponse({
                "success": False,
                "message": "Too many failed attempts. Please request a new OTP."
            }, status=400)
        
        # Verify OTP
        if entered_otp == otp_data['otp']:
            try:
                # Create user account
                new_user = User.objects.create(
                    username=otp_data['username'],
                    email=otp_data['email'],
                    password=otp_data['password']  # Already hashed
                )
                
                # Clear OTP data
                OTPManager.clear_otp_data(request)
                
                logger.info(f"User {new_user.username} registered successfully")
                return JsonResponse({
                    "success": True,
                    "message": "Account created successfully! You can now login."
                })
                
            except Exception as e:
                logger.error(f"Error creating user: {str(e)}")
                return JsonResponse({
                    "success": False,
                    "message": "Failed to create account. Please try again."
                }, status=500)
        else:
            # Increment failed attempts
            attempts = OTPManager.increment_attempts(request)
            remaining_attempts = 5 - attempts
            
            if remaining_attempts > 0:
                return JsonResponse({
                    "success": False,
                    "message": f"Invalid OTP. {remaining_attempts} attempts remaining."
                }, status=400)
            else:
                OTPManager.clear_otp_data(request)
                return JsonResponse({
                    "success": False,
                    "message": "Too many failed attempts. Please request a new OTP."
                }, status=400)
            
    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid request data"
        }, status=400)
        
    except Exception as e:
        logger.error(f"Error in verify_otp: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": "An unexpected error occurred. Please try again."
        }, status=500)

def user_login(request):
    """Handle user login"""
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        if not username or not password:
            messages.error(request, 'Please enter both username and password.')
            return redirect('login_page')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            messages.success(request, f'Welcome back, {user.username}!')
            return redirect('dashboard')  # Redirect to your dashboard URL
        else:
            messages.error(request, 'Invalid username or password.')
            return redirect('login_page')
    
    return render(request, 'login_manager/signin-signup-page.html')

# Legacy signup handler (if still needed for fallback)
def handle_signup(request):
    """Legacy signup handler - consider removing if OTP is primary method"""
    if request.method != 'POST':
        return redirect('login_page')
        
    username = request.POST.get('username', '').strip()
    email = request.POST.get('email', '').strip().lower()
    password = request.POST.get('password', '')
    confirm_password = request.POST.get('confirm-password', '')

    # Validate passwords match
    if password != confirm_password:
        messages.error(request, 'Passwords do not match.')
        return redirect('login_page')

    # Validate input data
    validation_errors = validate_signup_data(username, email, password)
    if validation_errors:
        for error in validation_errors:
            messages.error(request, error)
        return redirect('login_page')

    try:
        # Create user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )
        messages.success(request, 'Account created successfully. Please log in.')
        logger.info(f"User {username} created via legacy signup")
        
    except Exception as e:
        logger.error(f"Error in legacy signup: {str(e)}")
        messages.error(request, 'Failed to create account. Please try again.')
    
    return redirect('login_page')