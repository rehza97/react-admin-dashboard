
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static  # ✅ Correct import
urlpatterns = [
    path('admin/', admin.site.urls),
    path('users/' , include('users.urls')),
    path('api/auth/', include('knox.urls')),
    path('users/api/password_reset/', include('django_rest_passwordreset.urls', namespace='password_reset')),
    
    
    
    
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
