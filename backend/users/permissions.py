from rest_framework.permissions import BasePermission
from .models import UserDOTPermission
from .utils import filter_by_dot_permissions


class IsAdminUser(BasePermission):
    """
    Custom permission to only allow admin users to access the view.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_staff)

    def has_object_permission(self, request, view, obj):
        # Prevent admins from modifying their own role
        if view.action == 'role' and obj == request.user:
            return False
        return bool(request.user and request.user.is_staff)


class IsAnalyst(BasePermission):
    """
    Custom permission for analyst role
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.groups.filter(name='Analyst').exists())


class IsSelfOrAdmin(BasePermission):
    """
    Allow users to edit their own profile, or admins to edit any profile
    """

    def has_object_permission(self, request, view, obj):
        return bool(
            request.user and
            (request.user.is_staff or obj == request.user)
        )


class DOTDepartmentPermission(BasePermission):
    """
    Permission class for DOT department-specific access
    """

    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return False

        # Admins have full access
        if request.user.is_admin:
            return True

        # Get the DOT parameter from the request
        dot = request.query_params.get('dot', None)

        # If no DOT specified, apply general permissions
        if not dot:
            return True

        # Check if user has access to the specified DOT
        user_dots = request.user.profile.get_authorized_dots()

        # If user has access to all DOTs or the specific DOT
        return 'all' in user_dots or dot in user_dots


class DOTPermissionMixin:
    """
    Mixin to filter querysets based on user DOT permissions.
    This should be used in all view classes that need to filter data by DOT.
    """
    dot_field = 'dot'  # Default field name for DOT in models

    def get_queryset(self):
        """
        Filter the queryset based on the user's DOT permissions.
        """
        queryset = super().get_queryset()
        return filter_by_dot_permissions(
            queryset,
            self.request.user,
            dot_field=self.dot_field
        )
