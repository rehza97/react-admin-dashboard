from django.urls import path
from .views import (
    LoginViewset,
    RegisterViewset,
    UserProfileViewSet,
    CurrentUserView,
    UserManagementViewSet,
    DOTListView,
    DOTDetailView
)
from knox import views as knox_views

urlpatterns = [
    path('api/login/', LoginViewset.as_view({'post': 'create'}), name='login'),
    path('api/register/',
         RegisterViewset.as_view({'post': 'create'}), name='register'),
    path('api/logout/', knox_views.LogoutView.as_view(), name='logout'),
    path('api/logoutall/', knox_views.LogoutAllView.as_view(), name='logoutall'),
    path('api/profile/', UserProfileViewSet.as_view(
        {'get': 'retrieve', 'put': 'update'}), name='profile'),
    path('api/current-user/', CurrentUserView.as_view(), name='current-user'),
    path('api/users/', UserManagementViewSet.as_view(
        {'get': 'list', 'post': 'create'}), name='users-list'),
    path('api/users/inactive/',
         UserManagementViewSet.as_view({'get': 'inactive'}), name='users-inactive'),
    path('api/users/stats/',
         UserManagementViewSet.as_view({'get': 'stats'}), name='users-stats'),
    path('api/users/<int:pk>/', UserManagementViewSet.as_view(
        {'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}), name='users-detail'),
    path('api/users/<int:pk>/role/',
         UserManagementViewSet.as_view({'patch': 'role'}), name='user-role'),
    path('api/users/<int:pk>/disable/',
         UserManagementViewSet.as_view({'post': 'disable'}), name='user-disable'),
    path('api/users/<int:pk>/enable/',
         UserManagementViewSet.as_view({'post': 'enable'}), name='user-enable'),
    path('api/users/<int:pk>/hard-delete/',
         UserManagementViewSet.as_view({'delete': 'hard_delete'}), name='user-hard-delete'),
    path('api/users/<int:pk>/assign-group/',
         UserManagementViewSet.as_view({'post': 'assign_group'}), name='user-assign-group'),
    path('api/users/<int:pk>/dot-permissions/', UserManagementViewSet.as_view(
        {'get': 'dot_permissions'}), name='user-dot-permissions'),
    path('api/users/<int:pk>/assign-dot/',
         UserManagementViewSet.as_view({'post': 'assign_dot'}), name='user-assign-dot'),
    path('api/users/<int:pk>/remove-dot/',
         UserManagementViewSet.as_view({'delete': 'remove_dot'}), name='user-remove-dot'),
    path('api/dots/', DOTListView.as_view(), name='dot-list'),
    path('api/dots/<int:pk>/', DOTDetailView.as_view(), name='dot-detail'),
]
