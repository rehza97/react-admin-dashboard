from .serializers import UserSerializer
from .models import CustomUser
from rest_framework.views import APIView
from rest_framework import viewsets, permissions
from django.shortcuts import render
from .models import *
from .serializers import *
from rest_framework.response import Response
from django.contrib.auth import get_user_model, authenticate
from rest_framework import viewsets, permissions, response, status
from knox.models import AuthToken
from rest_framework.decorators import action
from django.contrib.auth.decorators import login_required
from .serializers import UserManagementSerializer, UserRoleSerializer, CustomPagination
from .permissions import IsAdminUser, IsSelfOrAdmin
from django.contrib.auth.models import Group
from django.core.exceptions import PermissionDenied
from django.db.models import Prefetch
from rest_framework.exceptions import ValidationError
from .utils import log_admin_action
from rest_framework import generics
import logging

logger = logging.getLogger(__name__)


class hello(viewsets.ViewSet):
    pass


User = get_user_model()
# Create your views here.


class LoginViewset(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializers

    def create(self, request):
        serializer = self.serializer_class(data=request.data)

        if serializer.is_valid():
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']

            logger.debug(
                f"Attempting to authenticate user with email: {email}")

            user = authenticate(request, username=email, password=password)

            if user:
                _, token = AuthToken.objects.create(user)
                return Response({
                    'user': self.serializer_class(user).data,
                    'token': token,
                })
            else:
                logger.warning(f"Authentication failed for email: {email}")
                return Response({'error': 'invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        else:
            logger.error(f"Serializer errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RegisterViewset(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]
    queryset = User.objects.all()
    serializer_class = RegisterSerializers

    def create(self, request):
        # Fix the typo from 'date' to 'data'
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return response.Response(serializer.data)
        else:
            return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UsersListViewset(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = User.objects.all()
    serializer_class = RegisterSerializers

    def list(self, request):
        queryset = User.objects.all()
        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data)


class UserProfileViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        """Return only the authenticated user's profile."""
        return User.objects.filter(id=self.request.user.id)

    def get_object(self):
        """Ensure the correct user is retrieved."""
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        """Handles GET request for user profile"""
        serializer = self.serializer_class(self.get_object())
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        """Handles PUT request for updating user profile"""
        serializer = self.serializer_class(
            self.get_object(), data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=200)
        return Response(serializer.errors, status=400)


class UserManagementViewSet(viewsets.ModelViewSet):
    serializer_class = UserManagementSerializer
    permission_classes = [IsAdminUser]
    pagination_class = CustomPagination

    def get_queryset(self):
        return User.objects.prefetch_related('groups').select_related()

    def get_object(self):
        """
        Retrieve the user specified by the primary key in the URL.
        """
        pk = self.kwargs.get('pk')
        return User.objects.get(pk=pk)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get user statistics
        """
        from django.db.models import Count
        stats = User.objects.values('role').annotate(
            count=Count('id')
        )
        return Response(stats)

    def perform_create(self, serializer):
        """
        Set role based on request data and user permissions
        """
        role = self.request.data.get('role', 'viewer')
        if not self.request.user.is_superuser and role == 'admin':
            role = 'viewer'
        serializer.save(role=role)

    def get_permissions(self):
        """
        Override to use different permission classes for different actions
        """
        if self.action in ['update', 'partial_update']:
            self.permission_classes = [IsSelfOrAdmin]
        return super().get_permissions()

    @action(detail=True, methods=['patch'], serializer_class=UserRoleSerializer)
    def role(self, request, pk=None):
        """
        Update user role (staff/superuser status)
        """
        user = self.get_object()

        try:
            # Validate role change
            if user == request.user:
                raise ValidationError("You cannot modify your own role.")

            if not request.user.is_superuser and request.data.get('is_superuser'):
                raise ValidationError(
                    "Only superusers can grant superuser status.")

            old_role = user.role
            serializer = self.get_serializer(
                user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()

            # Log role change
            log_admin_action(
                request.user,
                'change_role',
                target=user.email,
                details=f"Role changed from {old_role} to {user.role}"
            )

            return Response(serializer.data)

        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()

        try:
            # Prevent self-deletion
            if user == request.user:
                raise ValidationError(f"{user} request")

            # Prevent superuser deletion by non-superusers
            if user.is_superuser and not request.user.is_superuser:
                raise ValidationError(
                    "Only superusers can delete superuser accounts.")

            # Soft delete
            user.is_active = False
            user.save()

            # Log deletion
            log_admin_action(
                request.user,
                'delete_user',
                target=user.email,
                details="Soft delete"
            )

            return Response(status=status.HTTP_204_NO_CONTENT)

        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def assign_group(self, request, pk=None):
        """
        Assign user to a group (Analyst, Admin, etc.)
        """
        user = self.get_object()
        group_name = request.data.get('group')

        if not group_name:
            return Response(
                {'error': 'Group name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            group = Group.objects.get(name=group_name)
            user.groups.add(group)
            return Response({'message': f'User added to {group_name} group'})
        except Group.DoesNotExist:
            return Response(
                {'error': f'Group {group_name} does not exist'},
                status=status.HTTP_404_NOT_FOUND
            )


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        """Return the currently authenticated user."""
        return self.request.user  # Directly return the authenticated user

    def get(self, request):
        """Return the currently authenticated user."""
        serializer = UserSerializer(self.get_object())
        return Response(serializer.data, status=status.HTTP_200_OK)
