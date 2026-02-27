"""
ASGI config for NexusGrid project.
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NexusGrid.settings')

application = get_asgi_application()
