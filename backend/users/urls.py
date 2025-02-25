from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegisterViewset, LoginViewset, UsersListViewset, UserProfileViewSet, hello, UserManagementViewSet, CurrentUserView

router = DefaultRouter()
router.register('register', RegisterViewset, basename='register')
router.register('login', LoginViewset, basename='login')
router.register('users-list', UsersListViewset, basename='users-list')
router.register('hello', hello, basename='hello')
router.register('user-profile', UserProfileViewSet, basename='user-profile')
router.register(r'api/users', UserManagementViewSet,
                basename='user-management')

urlpatterns = [
    path('', include(router.urls)),
    path('me/', CurrentUserView.as_view(), name='current-user'),
]
