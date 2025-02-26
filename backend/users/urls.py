from django.urls import path
from .views import (
    LoginViewset, 
    RegisterViewset, 
    UserProfileViewSet, 
    CurrentUserView,
    UserManagementViewSet
)
from knox import views as knox_views

urlpatterns = [
    path('api/login/', LoginViewset.as_view({'post': 'create'}), name='login'),
    path('api/register/', RegisterViewset.as_view({'post': 'create'}), name='register'),
    path('api/logout/', knox_views.LogoutView.as_view(), name='logout'),
    path('api/logoutall/', knox_views.LogoutAllView.as_view(), name='logoutall'),
    path('api/profile/', UserProfileViewSet.as_view({'get': 'retrieve', 'put': 'update'}), name='profile'),
    path('api/current-user/', CurrentUserView.as_view(), name='current-user'),
    path('api/users/', UserManagementViewSet.as_view({'get': 'list', 'post': 'create'}), name='users-list'),
    path('api/users/<int:pk>/', UserManagementViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}), name='users-detail'),
]
