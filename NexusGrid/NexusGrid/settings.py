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
# ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['127.0.0.1', 'localhost', '.onrender.com'])
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']

# Session Engine
SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Site ID for django.contrib.sites (required by allauth)
SITE_ID = 1

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
    'django.contrib.sites',       # Required by allauth
    'django.contrib.humanize',    # If you intend to use humanize filters

    # Third-Party Apps
    'rest_framework',             # Django REST Framework
    'corsheaders',                # CORS handling
    "django_extensions",          # Useful management commands
    "channels",                   # WebSockets
    'compressor',                 # Static file compression

    # Authentication (django-allauth)
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    # Add specific social auth providers if needed, e.g.:
    # 'allauth.socialaccount.providers.google',
    # 'allauth.socialaccount.providers.facebook',

    # Custom Project Apps
    'login_manager',
    'dashboard',
    'system_layout',
    'monitoring',
    'faults',
    'resources',
    'reports',
    'userprivileges',
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
    'allauth.account.middleware.AccountMiddleware', # Required by allauth
]

# ------------------------------------------------------------------------------
# 4. URLS AND TEMPLATES
# ------------------------------------------------------------------------------

ROOT_URLCONF = 'NexusGrid.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "templates"], # Project-level templates
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

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST'),
        'PORT': env('DB_PORT'),
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

# Directories where Django should look for static files (in addition to app's static folders)
STATICFILES_DIRS = [
    BASE_DIR / "static", # Project-level static files
]

# The absolute path to the directory where collectstatic will collect static files for deployment.
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Finders tell Django how to find static files
STATICFILES_FINDERS = (
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
    'compressor.finders.CompressorFinder', # Essential for django-compressor
)

# Media files (user uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / "media"

# ------------------------------------------------------------------------------
# 7. DJANGO-COMPRESSOR SETTINGS
# ------------------------------------------------------------------------------

# Enable/disable compression based on DEBUG mode (enabled when DEBUG is False)
COMPRESS_ENABLED = not DEBUG

# If True, `manage.py compress` must be run to generate compressed files
# otherwise, compression happens on-the-fly (not recommended for production)
COMPRESS_OFFLINE = False

# Where compressor should look for source static files (usually same as STATIC_ROOT)
COMPRESS_ROOT = STATIC_ROOT

# URL from which compressed files will be served (usually same as STATIC_URL)
COMPRESS_URL = STATIC_URL

# Filters for CSS minification (requires 'cssmin' package: pip install cssmin)
COMPRESS_CSS_FILTERS = [
    'compressor.filters.cssmin.CSSMinFilter',
]

# Filters for JavaScript minification (requires 'jsmin' package: pip install jsmin)
COMPRESS_JS_FILTERS = [
    'compressor.filters.jsmin.JSMinFilter',
]

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

SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False

# ------------------------------------------------------------------------------
# 9. AUTHENTICATION & ALLAUTH SETTINGS
# ------------------------------------------------------------------------------

# Custom user model
AUTH_USER_MODEL = 'login_manager.User'

# Redirect URLs after login/logout
LOGIN_REDIRECT_URL = "dashboard"
ACCOUNT_LOGOUT_REDIRECT_URL = "/" # Or wherever you want to redirect after logout
LOGIN_URL = "/accounts/login/" # Default URL for login, used by login_required decorator etc.

# Allauth specific settings
ACCOUNT_LOGIN_METHODS = {'username', 'email'}  # replaces AUTHENTICATION_METHOD
ACCOUNT_SIGNUP_FIELDS = ['email*', 'password1*', 'password2*']  # replaces all 3 deprecated ones

ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_EMAIL_VERIFICATION = "mandatory" # or "optional", "none"
ACCOUNT_SESSION_REMEMBER = True
ACCOUNT_FORMS = {
    'signup': 'login_manager.forms.CustomSignupForm', # Example if you have a custom signup form
}

AUTHENTICATION_BACKENDS = (
    # Needed to login by username in Django Admin, regardless of `allauth`
    'django.contrib.auth.backends.ModelBackend',
    # `allauth` specific authentication methods, such as login by email
    'allauth.account.auth_backends.AuthenticationBackend',
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
        'rest_framework.permissions.AllowAny', # Change for authentication later
    ],
    # 'DEFAULT_AUTHENTICATION_CLASSES': [
    #     'rest_framework.authentication.SessionAuthentication',
    #     'rest_framework.authentication.BasicAuthentication',
    # ],
}

# ------------------------------------------------------------------------------
# 11. CORS HEADERS SETTINGS
# ------------------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[
    "http://localhost:8000",
])
# CORS_ALLOW_ALL_ORIGINS = True # Be careful with this in production!

# ------------------------------------------------------------------------------
# 12. CHANNELS (WEBSOCKETS) SETTINGS
# ------------------------------------------------------------------------------

ASGI_APPLICATION = "NexusGrid.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [(env("REDIS_HOST", default="127.0.0.1"), int(env("REDIS_PORT", default="6379")))],
        },
    },
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