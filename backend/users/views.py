from .serializers import UserSerializer
from .models import CustomUser, UserDOTPermission
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
from .serializers import UserManagementSerializer, UserRoleSerializer, CustomPagination, DOTPermissionAssignmentSerializer
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
        return User.objects.filter(id=self.request.user.id).prefetch_related('dot_permissions')

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
        # By default, show only active users unless specifically requested
        show_inactive = self.request.query_params.get(
            'show_inactive', 'false').lower() == 'true'
        queryset = User.objects.prefetch_related('groups', 'dot_permissions')

        if not show_inactive:
            queryset = queryset.filter(is_active=True)

        return queryset

    def get_object(self):
        """
        Retrieve the user specified by the primary key in the URL.
        """
        pk = self.kwargs.get('pk')
        return User.objects.prefetch_related('dot_permissions').get(pk=pk)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get user statistics
        """
        from django.db.models import Count
        stats = User.objects.values('role').annotate(
            count=Count('id')
        )

        # Add active/inactive stats
        active_count = User.objects.filter(is_active=True).count()
        inactive_count = User.objects.filter(is_active=False).count()

        return Response({
            'roles': stats,
            'active_users': active_count,
            'inactive_users': inactive_count
        })

    @action(detail=False, methods=['get'])
    def inactive(self, request):
        """
        Get list of inactive (soft-deleted) users
        """
        inactive_users = User.objects.filter(is_active=False)
        page = self.paginate_queryset(inactive_users)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(inactive_users, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        """
        Set role based on request data and user permissions
        """
        try:
            role = self.request.data.get('role', 'viewer')
            # Only superusers can create admin users
            if not self.request.user.is_superuser and role == 'admin':
                role = 'viewer'

            # Create the user
            user = serializer.save(role=role)

            # Log the action
            log_admin_action(
                self.request.user,
                'create_user',
                target=user.email,
                details=f"Role: {user.role}"
            )

            return user
        except Exception as e:
            # Log the error
            logger.error(f"Error creating user: {str(e)}")
            # Re-raise the exception to let DRF handle the response
            raise

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

    @action(detail=True, methods=['post'])
    def disable(self, request, pk=None):
        """
        Soft delete (disable) a user account
        """
        user = self.get_object()

        try:
            # Prevent self-deletion
            if user == request.user:
                raise ValidationError("You cannot disable your own account.")

            # Prevent superuser deletion by non-superusers
            if user.is_superuser and not request.user.is_superuser:
                raise ValidationError(
                    "Only superusers can disable superuser accounts.")

            # Soft delete
            user.is_active = False
            user.save()

            # Log action
            log_admin_action(
                request.user,
                'disable_user',
                target=user.email,
                details="Account disabled"
            )

            return Response({"message": f"User {user.email} has been disabled."},
                            status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def enable(self, request, pk=None):
        """
        Re-enable a disabled user account
        """
        user = self.get_object()

        try:
            # Prevent superuser enabling by non-superusers
            if user.is_superuser and not request.user.is_superuser:
                raise ValidationError(
                    "Only superusers can enable superuser accounts.")

            # Enable account
            user.is_active = True
            user.save()

            # Log action
            log_admin_action(
                request.user,
                'enable_user',
                target=user.email,
                details="Account enabled"
            )

            return Response({"message": f"User {user.email} has been enabled."},
                            status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['delete'])
    def hard_delete(self, request, pk=None):
        """
        Permanently delete a user account
        """
        user = self.get_object()

        try:
            # Prevent self-deletion
            if user == request.user:
                raise ValidationError("You cannot delete your own account.")

            # Prevent superuser deletion by non-superusers
            if user.is_superuser and not request.user.is_superuser:
                raise ValidationError(
                    "Only superusers can delete superuser accounts.")

            email = user.email
            # Hard delete
            user.delete()

            # Log action
            log_admin_action(
                request.user,
                'hard_delete_user',
                target=email,
                details="Account permanently deleted"
            )

            return Response({"message": f"User {email} has been permanently deleted."},
                            status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, *args, **kwargs):
        """
        Default destroy method - performs soft delete
        """
        user = self.get_object()

        try:
            # Prevent self-deletion
            if user == request.user:
                raise ValidationError("You cannot disable your own account.")

            # Prevent superuser deletion by non-superusers
            if user.is_superuser and not request.user.is_superuser:
                raise ValidationError(
                    "Only superusers can disable superuser accounts.")

            # Soft delete
            user.is_active = False
            user.save()

            # Log deletion
            log_admin_action(
                request.user,
                'disable_user',
                target=user.email,
                details="Account disabled"
            )

            return Response({"message": f"User {user.email} has been disabled."},
                            status=status.HTTP_200_OK)

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

    @action(detail=True, methods=['get'])
    def dot_permissions(self, request, pk=None):
        """
        Get DOT permissions for a user
        """
        user = self.get_object()
        permissions = user.dot_permissions.all()
        serializer = UserDOTPermissionSerializer(permissions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], serializer_class=DOTPermissionAssignmentSerializer)
    def assign_dot(self, request, pk=None):
        """
        Assign a DOT permission to a user
        """
        user = self.get_object()

        # Log incoming data for debugging
        logger.info(f"Assign DOT request data: {request.data}")

        # Create a serializer with ONLY the DOT data
        serializer = DOTPermissionAssignmentSerializer(data=request.data)

        if serializer.is_valid():
            dot_code = serializer.validated_data['dot_code']
            dot_name = serializer.validated_data['dot_name']

            try:
                # Create or update the permission
                permission, created = UserDOTPermission.objects.update_or_create(
                    user=user,
                    dot_code=dot_code,
                    defaults={'dot_name': dot_name}
                )

                # Log the action
                action_type = 'create_dot_permission' if created else 'update_dot_permission'
                log_admin_action(
                    request.user,
                    action_type,
                    target=user.email,
                    details=f"DOT: {dot_code} ({dot_name})"
                )

                return Response({
                    'message': f"DOT permission {'created' if created else 'updated'} successfully",
                    'permission': UserDOTPermissionSerializer(permission).data
                })
            except Exception as e:
                logger.error(f"Error creating DOT permission: {str(e)}")
                return Response(
                    {'error': f"Error assigning DOT permission: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            # Log validation errors for debugging
            logger.error(
                f"DOT assignment validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'], url_path='remove-dot/(?P<dot_code>[^/.]+)')
    def remove_dot_by_path(self, request, pk=None, dot_code=None):
        """
        Remove a DOT permission from a user using path parameter
        """
        user = self.get_object()

        # Log request details for debugging
        logger.info(
            f"Remove DOT by path request. User: {pk}, DOT code: {dot_code}")

        if not dot_code:
            logger.error("DOT code not provided in path")
            return Response(
                {'error': 'DOT code is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            permission = UserDOTPermission.objects.get(
                user=user, dot_code=dot_code)
            dot_name = permission.dot_name
            permission.delete()

            # Log the action
            log_admin_action(
                request.user,
                'delete_dot_permission',
                target=user.email,
                details=f"DOT: {dot_code} ({dot_name})"
            )

            return Response({'message': 'DOT permission removed successfully'})
        except UserDOTPermission.DoesNotExist:
            logger.error(
                f"DOT permission not found: user={user.id}, dot_code={dot_code}")
            return Response(
                {'error': f'DOT permission with code {dot_code} not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get(self, request):
        user = self.get_object()
        serializer = UserSerializer(user)
        return Response(serializer.data)


class DOTListView(APIView):
    """
    API view for listing and creating DOTs
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """
        Return a list of all available DOTs from the DOT model
        """
        try:
            from data.models import DOT

            # Check if we have DOTs in the DOT model
            dots_count = DOT.objects.count()

            # If no DOTs in the model, populate it from other models
            if dots_count == 0:
                self._populate_dot_model()

            # Get all DOTs, active ones first
            dots = DOT.objects.all().order_by('-is_active', 'code')

            # Format the response
            formatted_dots = []
            for dot in dots:
                formatted_dots.append({
                    "id": dot.id,
                    "dot_code": dot.code,
                    "dot_name": dot.name,
                    "code": dot.code,
                    "name": dot.name,
                    "description": dot.description,
                    "is_active": dot.is_active,
                    "created_at": dot.created_at,
                    "updated_at": dot.updated_at
                })

            return Response(formatted_dots)
        except Exception as e:
            # If there's an error (e.g., DOT model doesn't exist yet), return default DOTs
            default_dots = []
            return Response(default_dots)

    def post(self, request):
        """
        Create a new DOT
        """
        from data.models import DOT
        from rest_framework import serializers

        # Simple serializer for validation
        class DOTSerializer(serializers.ModelSerializer):
            class Meta:
                model = DOT
                fields = ['code', 'name', 'description', 'is_active']

        serializer = DOTSerializer(data=request.data)
        if serializer.is_valid():
            dot = serializer.save()
            return Response({
                "id": dot.id,
                "code": dot.code,
                "name": dot.name,
                "description": dot.description,
                "is_active": dot.is_active,
                "created_at": dot.created_at,
                "updated_at": dot.updated_at
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def _populate_dot_model(self):
        """
        Populate the DOT model with values from other models that have a dot field
        """
        from data.models import DOT

        # Get unique DOT values from all models that have a dot field
        dot_values = set()

        try:
            # Add default DOTs
            default_dots = {
              
            }

            for code, name in default_dots.items():
                DOT.objects.get_or_create(
                    code=code,
                    defaults={"name": name}
                )

            # Add DOTs from JournalVentes (organization field)
            from data.models import JournalVentes
            try:
                journal_dots = JournalVentes.objects.exclude(organization__isnull=True).exclude(
                    organization='').values_list('organization', flat=True).distinct()
                dot_values.update(journal_dots)
            except Exception as e:
                print(f"Error getting DOTs from JournalVentes: {str(e)}")

            # Add DOTs from EtatFacture (organization field)
            from data.models import EtatFacture
            try:
                etat_dots = EtatFacture.objects.exclude(organization__isnull=True).exclude(
                    organization='').values_list('organization', flat=True).distinct()
                dot_values.update(etat_dots)
            except Exception as e:
                print(f"Error getting DOTs from EtatFacture: {str(e)}")

            # Add DOTs from ParcCorporate (state field)
            from data.models import ParcCorporate
            try:
                parc_dots = ParcCorporate.objects.exclude(state__isnull=True).exclude(
                    state='').values_list('state', flat=True).distinct()
                # Extract DOT codes from state field (format: "State (DOT: CODE)")
                for state in parc_dots:
                    if '(DOT:' in state:
                        dot_code = state.split('(DOT:')[-1].strip(')').strip()
                        if dot_code:
                            dot_values.add(dot_code)
                    else:
                        dot_values.add(state)
            except Exception as e:
                print(f"Error getting DOTs from ParcCorporate: {str(e)}")

            # Try to get DOTs from other models that might have a dot field
            try:
                from data.models import (
                    CreancesNGBSS,
                    CAPeriodique,
                    CANonPeriodique,
                    CADNT,
                    CARFD,
                    CACNT,
                    NGBSSCollection,
                    UnfinishedInvoice,
                    RevenueObjective,
                    CollectionObjective
                )

                models_with_dot = [
                    CreancesNGBSS, CAPeriodique, CANonPeriodique, CADNT, CARFD, CACNT,
                    NGBSSCollection, UnfinishedInvoice, RevenueObjective, CollectionObjective
                ]

                for model in models_with_dot:
                    try:
                        # Check if model has a dot field that's a ForeignKey to DOT
                        if any(f.name == 'dot' and f.remote_field and f.remote_field.model == DOT for f in model._meta.fields):
                            # For models with DOT ForeignKey
                            dots = model.objects.exclude(dot__isnull=True).values_list(
                                'dot__code', flat=True).distinct()
                            dot_values.update(dots)
                        elif any(f.name == 'dot' for f in model._meta.fields):
                            # For models with dot as a CharField
                            dots = model.objects.exclude(dot__isnull=True).exclude(
                                dot='').values_list('dot', flat=True).distinct()
                            dot_values.update(dots)
                        elif any(f.name == 'dot_code' for f in model._meta.fields):
                            # For models with dot_code field
                            dots = model.objects.exclude(dot_code__isnull=True).exclude(
                                dot_code='').values_list('dot_code', flat=True).distinct()
                            dot_values.update(dots)
                    except Exception as e:
                        print(
                            f"Error getting DOTs from {model.__name__}: {str(e)}")
            except Exception as e:
                print(f"Error importing models: {str(e)}")

            # Create DOT objects for each unique value
            for dot_code in dot_values:
                if not dot_code:
                    continue

                # Skip if already exists
                if DOT.objects.filter(code=dot_code).exists():
                    continue

                # Create new DOT object
                DOT.objects.create(
                    code=dot_code,
                    name=dot_code  # Use code as name initially
                )

        except Exception as e:
            print(f"Error populating DOT model: {str(e)}")


class DOTDetailView(APIView):
    """
    API view for retrieving, updating, and deleting a specific DOT
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk):
        try:
            from data.models import DOT
            try:
                return DOT.objects.get(pk=pk)
            except DOT.DoesNotExist:
                raise Http404
        except Exception as e:
            # If there's an error (e.g., DOT model doesn't exist yet), raise Http404
            raise Http404

    def get(self, request, pk):
        """
        Retrieve a DOT by ID
        """
        try:
            dot = self.get_object(pk)
            return Response({
                "id": dot.id,
                "code": dot.code,
                "name": dot.name,
                "description": dot.description,
                "is_active": dot.is_active,
                "created_at": dot.created_at,
                "updated_at": dot.updated_at
            })
        except Http404:
            return Response({"error": "DOT not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request, pk):
        """
        Update a DOT
        """
        try:
            from data.models import DOT
            from rest_framework import serializers

            dot = self.get_object(pk)

            # Simple serializer for validation
            class DOTSerializer(serializers.ModelSerializer):
                class Meta:
                    model = DOT
                    fields = ['name', 'description', 'is_active']
                    # Code cannot be changed once created
                    read_only_fields = ['code']

            serializer = DOTSerializer(dot, data=request.data, partial=True)
            if serializer.is_valid():
                dot = serializer.save()
                return Response({
                    "id": dot.id,
                    "code": dot.code,
                    "name": dot.name,
                    "description": dot.description,
                    "is_active": dot.is_active,
                    "created_at": dot.created_at,
                    "updated_at": dot.updated_at
                })
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Http404:
            return Response({"error": "DOT not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, pk):
        """
        Delete a DOT
        """
        try:
            dot = self.get_object(pk)

            # Check if this DOT is being used by any models
            # If it is, we should not allow deletion
            from data.models import (
                CreancesNGBSS, CAPeriodique, CANonPeriodique, CADNT, CARFD, CACNT,
                NGBSSCollection, UnfinishedInvoice, RevenueObjective, CollectionObjective
            )

            models_to_check = [
                CreancesNGBSS, CAPeriodique, CANonPeriodique, CADNT, CARFD, CACNT,
                NGBSSCollection, UnfinishedInvoice, RevenueObjective, CollectionObjective
            ]

            for model in models_to_check:
                if model.objects.filter(dot=dot).exists():
                    return Response({
                        "error": "Cannot delete DOT because it is being used by other records. Consider deactivating it instead."
                    }, status=status.HTTP_400_BAD_REQUEST)

            dot.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Http404:
            return Response({"error": "DOT not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
