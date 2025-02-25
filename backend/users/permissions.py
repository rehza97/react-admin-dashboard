from rest_framework.permissions import BasePermission


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
