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
