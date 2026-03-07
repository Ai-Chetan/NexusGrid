# settings.py

import os
from pathlib import Path
import environ

# ------------------------------------------------------------------------------
# 1. CORE PROJECT SETTINGS
# ------------------------------------------------------------------------------

# Initialize environment variables from .env file
env = environ.Env()
BASE_DIR = Path(__file__).resolve().parent.parent
environ.Env.read_env(os.path.join(BASE_DIR, ".env"))

# Secret key for Django project (NEVER hardcode in production!)
SECRET_KEY = env('SECRET_KEY') # No default here for production safety

# Debug mode: True for development, False for production
DEBUG = env.bool('DEBUG', default=False)

# Allowed hosts for the application
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['127.0.0.1', 'localhost', '.onrender.com'])

# ── Cache + Session backend ───────────────────────────────────────────────────
# Set USE_REDIS=True in .env / production environment when Redis is available.
# Without it, the app falls back to in-process LocMemCache (no cross-worker
# sharing, but avoids every cache.get() silently returning None and running
# 10+ DB queries per dashboard load).
USE_REDIS = env.bool('USE_REDIS', default=False)

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ------------------------------------------------------------------------------
# 2. INSTALLED APPLICATIONS
# ------------------------------------------------------------------------------

INSTALLED_APPS = [
    # Django Built-in Apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-Party Apps
    'rest_framework',             # Django REST Framework
    'corsheaders',                # CORS handling
    "django_extensions",          # Useful management commands

    # Custom Project Apps
    'api_v1',
    'login_manager',
    'system_layout',
    'monitoring',
    'faults',
    'resources',
]

# ------------------------------------------------------------------------------
# 3. MIDDLEWARE CONFIGURATION
# ------------------------------------------------------------------------------

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',      # CORS Middleware (place after SessionMiddleware)
    'django.middleware.common.CommonMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware', # For serving static files in production
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ------------------------------------------------------------------------------
# 4. URLS AND TEMPLATES
# ------------------------------------------------------------------------------

ROOT_URLCONF = 'NexusGrid.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],  # No project-level templates (React SPA handles the UI)
        'APP_DIRS': True, # Allows Django to find templates within app directories
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'NexusGrid.wsgi.application'

# ------------------------------------------------------------------------------
# 5. DATABASE CONFIGURATION
# ------------------------------------------------------------------------------

# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.postgresql',
#         'NAME': env('DB_NAME'),
#         'USER': env('DB_USER'),
#         'PASSWORD': env('DB_PASSWORD'),
#         'HOST': env('DB_HOST'),
#         'PORT': env('DB_PORT'),
#     }
# }

DATABASES = {
    'default': {
        **env.db('DATABASE_URL'),
        'OPTIONS': {
            'connect_timeout': 10,  # seconds — gives Neon time to wake up
            'sslmode': 'require',
        },
        'CONN_MAX_AGE': 0,  # Disable persistent connections (required for Neon serverless)
    }
}

# Password validation for user creation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ------------------------------------------------------------------------------
# 6. STATIC AND MEDIA FILES
# ------------------------------------------------------------------------------

# URL to serve static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'

# No project-level static directory (React builds to frontend/dist, served separately)
# The absolute path to the directory where collectstatic will collect static files for deployment.
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Finders — only app-level static files (admin, DRF browsable API)
STATICFILES_FINDERS = (
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
)

# Media files (user uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / "media"

# ------------------------------------------------------------------------------
# 8. SECURITY SETTINGS (for deployment)
# ------------------------------------------------------------------------------

# if not DEBUG:
#     SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=False)
#     SESSION_COOKIE_SECURE = env.bool('SESSION_COOKIE_SECURE', default=True)
#     CSRF_COOKIE_SECURE = env.bool('CSRF_COOKIE_SECURE', default=True)
#     # SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', default=31536000) # 1 year
#     SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=True)
#     SECURE_HSTS_PRELOAD = env.bool('SECURE_HSTS_PRELOAD', default=True)
# else:
#     SECURE_SSL_REDIRECT = False
#     SESSION_COOKIE_SECURE = False
#     CSRF_COOKIE_SECURE = False

SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=not DEBUG)
SESSION_COOKIE_SECURE = env.bool('SESSION_COOKIE_SECURE', default=not DEBUG)
CSRF_COOKIE_SECURE = env.bool('CSRF_COOKIE_SECURE', default=not DEBUG)
SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', default=31536000 if not DEBUG else 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=not DEBUG)
SECURE_HSTS_PRELOAD = env.bool('SECURE_HSTS_PRELOAD', default=not DEBUG)

# ------------------------------------------------------------------------------
# 9. AUTHENTICATION SETTINGS
# ------------------------------------------------------------------------------

# Custom user model
AUTH_USER_MODEL = 'login_manager.User'

AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',
)


# ------------------------------------------------------------------------------
# 10. DJANGO REST FRAMEWORK (DRF) SETTINGS
# ------------------------------------------------------------------------------

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
}

# ------------------------------------------------------------------------------
# 11. CORS HEADERS SETTINGS
# ------------------------------------------------------------------------------

PUBLIC_FRONTEND_ORIGINS = [
    "https://nexusgrid-systems.vercel.app",
    "https://nexusgrid.onrender.com",
]

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[
    "http://localhost:8000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    *PUBLIC_FRONTEND_ORIGINS,
])
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGIN_REGEXES = env.list(
    "CORS_ALLOWED_ORIGIN_REGEXES",
    default=[r"^https://.*\.vercel\.app$"],
)
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    *PUBLIC_FRONTEND_ORIGINS,
])
# CORS_ALLOW_ALL_ORIGINS = True # Be careful with this in production!

# Cross-site session auth (frontend on Vercel, API on Render) requires SameSite=None + Secure.
SESSION_COOKIE_SAMESITE = env('SESSION_COOKIE_SAMESITE', default='None' if not DEBUG else 'Lax')
CSRF_COOKIE_SAMESITE = env('CSRF_COOKIE_SAMESITE', default='None' if not DEBUG else 'Lax')

# ------------------------------------------------------------------------------
# 12b. CACHE CONFIGURATION (django-redis)
# ------------------------------------------------------------------------------
# Uses the same Redis instance as Channel Layers (DB 0 = channels, DB 1 = cache).
# Falls back to a local-memory dummy cache when Redis is not available in dev.

REDIS_LOCATION = f"redis://{env('REDIS_HOST', default='127.0.0.1')}:{env('REDIS_PORT', default='6379')}/1"

if USE_REDIS:
    SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_LOCATION,
            "KEY_PREFIX": "nexusgrid",
            "TIMEOUT": 300,  # default TTL: 5 minutes
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                # Silently degrade to cache misses instead of raising on connection errors
                "IGNORE_EXCEPTIONS": True,
            },
        }
    }
else:
    # Dev fallback: in-process memory cache.
    # Metrics ARE cached (per-process, reset on restart) — avoids 10+ queries
    # per dashboard load when Redis is not running locally.
    SESSION_ENGINE = "django.contrib.sessions.backends.db"
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "nexusgrid-dev",
        }
    }

# ------------------------------------------------------------------------------
# 13. EMAIL CONFIGURATION
# ------------------------------------------------------------------------------

EMAIL_HOST = env('EMAIL_HOST', default='smtp.example.com')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='webmaster@example.com')

# ------------------------------------------------------------------------------
# 14. LOGGING (Optional - Good for Production)
# ------------------------------------------------------------------------------
# Example basic logging configuration - uncomment and adapt as needed
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
    },
}