from django.contrib import admin
from .models import FaultReport, Resolved

# Register your models here.
admin.site.register([
     FaultReport,
     Resolved,
])