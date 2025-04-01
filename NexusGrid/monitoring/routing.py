from django.urls import re_path
from monitoring.consumers import DashboardConsumer
#this file is for socketio
websocket_urlpatterns = [
    re_path(r"ws/dashboard/(?P<mac_address>\w+)/$", DashboardConsumer.as_asgi()),
]
