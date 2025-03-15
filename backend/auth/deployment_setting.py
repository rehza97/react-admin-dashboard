import os
import dj_database_url
from .settings import *
from .settings import BASE_DIR

ALLOWED_HOSTS = [os.environ.get('RENDER_EXTERNAL_HOSTNAME')]
CSRF_TRUSTED_ORIGINS = ['https://*.127.0.0.1', 'https://*.localhost', 'https://*.render.com' , 'https://'+os.environ.get('RENDER_EXTERNAL_HOSTNAME')]

DEBUG = False

SECRET_KEY = os.environ.get('SECRET_KEY')


MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'users.middleware.RoleBasedAccessMiddleware',
]


# Set CORS settings based on environment
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Only allow all origins in debug mode
if not DEBUG:
    CORS_ALLOWED_ORIGINS = [
        "https://react-admin-dashboard-nz1d.onrender.com",
        # Add your production domain when deploying
    ]
else:
    # In debug mode, we'll log CORS requests for debugging
    CORS_ALLOW_ALL_ORIGINS = True
    print("DEBUG mode: CORS_ALLOW_ALL_ORIGINS is enabled")


STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}

DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL'),
        conn_max_age=600,
    )
}
