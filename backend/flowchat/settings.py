"""
Django settings for flowchat project.
"""

from pathlib import Path
from decouple import config
from datetime import timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)

def _csv_env(name: str, default_list: list[str]) -> list[str]:
    """Return comma-separated env var as list, or default_list if empty."""
    raw = config(name, default='')
    if isinstance(raw, str) and raw.strip():
        return [item.strip() for item in raw.split(',') if item.strip()]
    return default_list

ALLOWED_HOSTS = _csv_env('ALLOWED_HOSTS', ['localhost', '127.0.0.1', '.herokuapp.com', '.onrender.com'])

# Render: ensure the service's own hostname is allowed even if ALLOWED_HOSTS env is missing/mis-set
RENDER_HOST = config('RENDER_EXTERNAL_HOSTNAME', default='').strip()
if RENDER_HOST and RENDER_HOST not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_HOST)

# Frontend base URL used by Django admin "View site" link
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'channels',
    
    # Local apps
    'accounts',
    'chat',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'flowchat.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
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

WSGI_APPLICATION = 'flowchat.wsgi.application'
ASGI_APPLICATION = 'flowchat.asgi.application'

# Database
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=f"postgresql://{config('DB_USER', default='postgres')}:{config('DB_PASSWORD', default='password')}@{config('DB_HOST', default='localhost')}:{config('DB_PORT', default='5432')}/{config('DB_NAME', default='flowchat')}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# Use psycopg3 for PostgreSQL connections
DATABASES['default']['ENGINE'] = 'django.db.backends.postgresql'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# CORS settings
CORS_ALLOWED_ORIGINS = _csv_env(
    'CORS_ALLOWED_ORIGINS',
    [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://flowchat-app.vercel.app",
    ]
)

CORS_ALLOW_CREDENTIALS = True

# Trust Vercel frontend for CSRF protection as well
CSRF_TRUSTED_ORIGINS = _csv_env(
    'CSRF_TRUSTED_ORIGINS',
    [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://flowchat-app.vercel.app",
    ]
)

# Render: also trust the backend's HTTPS origin for CSRF if available
if RENDER_HOST:
    _render_origin = f"https://{RENDER_HOST}"
    if _render_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(_render_origin)

# Channels configuration
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [config('REDIS_URL', default='redis://localhost:6379')],
        },
    },
}

# Firebase configuration
FIREBASE_CONFIG = {
    'type': config('FIREBASE_TYPE', default='service_account'),
    'project_id': config('FIREBASE_PROJECT_ID', default=''),
    'private_key_id': config('FIREBASE_PRIVATE_KEY_ID', default=''),
    'private_key': config('FIREBASE_PRIVATE_KEY', default='').replace('\\n', '\n'),
    'client_email': config('FIREBASE_CLIENT_EMAIL', default=''),
    'client_id': config('FIREBASE_CLIENT_ID', default=''),
    'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
    'token_uri': 'https://oauth2.googleapis.com/token',
}
FIREBASE_CREDENTIALS_FILE = config('FIREBASE_CREDENTIALS_FILE', default='')

# Custom user model
AUTH_USER_MODEL = 'accounts.User'
