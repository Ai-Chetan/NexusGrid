from django.shortcuts import render,redirect
from django.contrib import messages
from django.contrib.auth import authenticate,login
from NexusGrid.models import User as CustomUser
import bcrypt # type: ignore

def login(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        try:
            custom_user = CustomUser.objects.get(username=username)
            if bcrypt.checkpw(password.encode(), custom_user.password.encode()):
                request.session['user_id'] = custom_user.user_id
                messages.success(request, "Login successful!")
                return redirect('Admin_Dash(temp).html')
            else:
                messages.error(request, "Invalid password.")
        except CustomUser.DoesNotExist:
            messages.error(request, "User does not exist.")
        return redirect('signin-signup-page.html')
    return render(request, 'signin-signup-page.html')