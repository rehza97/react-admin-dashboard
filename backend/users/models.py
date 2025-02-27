from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.contrib.auth.base_user import BaseUserManager
from django_rest_passwordreset.signals import reset_password_token_created
from django.dispatch import receiver
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags
from django.core.validators import validate_email, MinLengthValidator
from django.core.exceptions import ValidationError


class CustomUserManager(BaseUserManager):
    """Manager for custom user model where email is the unique identifier."""

    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user with the given email and password."""
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        validate_email(email)  # Validate email format

        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser with the given email and password."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(email, password, **extra_fields)


# Custom User Model
class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('analyst', 'Analyst'),
        ('viewer', 'Viewer'),
    ]

    # Remove username and use email instead
    username = None
    email = models.EmailField(
        'email address',
        unique=True,
        error_messages={
            'unique': 'A user with that email already exists.',
        },
        db_index=True
    )

    # Role field
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='viewer',
        db_index=True
    )

    # Profile fields
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    profile_picture = models.ImageField(
        upload_to='profile_pics/',
        null=True,
        blank=True
    )
    birthday = models.DateField(null=True, blank=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        indexes = [
            models.Index(fields=['email', 'role']),
            models.Index(fields=['date_joined']),
        ]
        ordering = ['-date_joined']

    def __str__(self):
        return self.email

    def get_full_name(self):
        """Return the user's full name."""
        return f"{self.first_name} {self.last_name}".strip() or self.email

    @property
    def is_admin(self):
        return self.role == 'admin' or self.is_superuser

    @property
    def is_analyst(self):
        return self.role == 'analyst'

    def save(self, *args, **kwargs):
        # Ensure email is lowercase
        self.email = self.email.lower()
        super().save(*args, **kwargs)

    def get_profile_data(self):
        """Return structured profile data."""
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.get_full_name(),
            "first_name": self.first_name,
            "last_name": self.last_name,
            "birthday": self.birthday.strftime("%Y-%m-%d") if self.birthday else None,
            "profile_picture": self.profile_picture.url if self.profile_picture else None,
        }


@receiver(reset_password_token_created)
def password_reset_token_created(reset_password_token, *args, **kwargs):
    """Send password reset email when a token is created."""
    sitelink = "http://localhost:5173/"
    token = "{}".format(reset_password_token.key)
    full_link = f"{sitelink}reset-password/{token}"

    context = {
        "full_link": full_link,
        "email_address": reset_password_token.user.email,
    }

    html_message = render_to_string("email.html", context=context)
    plain_message = strip_tags(html_message)

    msg = EmailMultiAlternatives(
        subject=f"Request for resetting password for {reset_password_token.user.email}",
        body=plain_message,
        from_email="developer@email.com",
        to=[reset_password_token.user.email],
    )
    msg.attach_alternative(html_message, "text/html")
    msg.send()
