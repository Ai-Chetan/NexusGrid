from django.shortcuts import render

# Create your views here.
def fault_reports(request):
    return render(request, 'faults/faults.html', {"user_role": request.user.role})