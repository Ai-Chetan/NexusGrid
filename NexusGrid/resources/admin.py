from django.contrib import admin
from .models import ResourceRequest, Provided

admin.site.register(ResourceRequest)
admin.site.register(Provided)
