import re
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
import logging

logger = logging.getLogger('users.audit')


def validate_password_strength(password):
    """
    Validate password strength
    - At least 8 characters
    - Contains uppercase and lowercase
    - Contains numbers
    - Contains special characters
    """
    if len(password) < 8:
        raise ValidationError("Password must be at least 8 characters long.")

    if not re.search(r'[A-Z]', password):
        raise ValidationError("Password must contain uppercase letters.")

    if not re.search(r'[a-z]', password):
        raise ValidationError("Password must contain lowercase letters.")

    if not re.search(r'[0-9]', password):
        raise ValidationError("Password must contain numbers.")

    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        raise ValidationError("Password must contain special characters.")


def log_admin_action(user, action, target=None, details=None):
    """
    Log admin actions with detailed information
    """
    log_entry = f"Admin Action: {action} | User: {user.email}"
    if target:
        log_entry += f" | Target: {target}"
    if details:
        log_entry += f" | Details: {details}"

    logger.info(log_entry)


def filter_by_dot_permissions(queryset, user, dot_field='dot'):
    """
    Filter a queryset based on a user's DOT permissions.

    Args:
        queryset: The queryset to filter
        user: The user whose permissions to check
        dot_field: The field name in the model that contains the DOT code

    Returns:
        Filtered queryset based on user's DOT permissions
    """
    # If user is admin or superuser, don't filter
    if user.is_staff or user.is_superuser:
        return queryset

    # Get user's authorized DOTs
    authorized_dots = user.get_authorized_dots()

    if not authorized_dots:
        # If user has no DOT permissions, return empty queryset
        return queryset.none()

    # Filter queryset by DOT field
    filter_kwargs = {f"{dot_field}__in": authorized_dots}
    return queryset.filter(**filter_kwargs)
