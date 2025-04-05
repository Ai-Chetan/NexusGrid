from django.shortcuts import render

# Create your views here.
def resource_request(request):
    return render(request, 'resources/resources.html', {"user_role": request.user.role})