
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

# Create schema view for Swagger documentation
schema_view = get_schema_view(
    openapi.Info(
        title="Admin Dashboard API",
        default_version='v1',
        description="API documentation for the Admin Dashboard",
        terms_of_service="https://www.example.com/terms/",
        contact=openapi.Contact(email="contact@example.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('users/' , include('users.urls')),
    path('api/auth/', include('knox.urls')),
    path('users/api/password_reset/', include('django_rest_passwordreset.urls', namespace='password_reset')),
    path('data/', include('data.urls')),  # This matches the proxy configuration
     # Swagger documentation URLs
    path('swagger<format>/', schema_view.without_ui(cache_timeout=0),
         name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger',
         cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc',
         cache_timeout=0), name='schema-redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)





