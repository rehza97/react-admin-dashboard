from rest_framework import serializers
from .models import *
from django.contrib.auth import get_user_model
from rest_framework.pagination import PageNumberPagination
from django.core.exceptions import ValidationError
from .utils import validate_password_strength, log_admin_action
from django.contrib.auth.hashers import make_password

User = get_user_model()


class LoginSerializers(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret.pop('password', None)
        return ret


class RegisterSerializers(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'password')
        extra_kwargs = {'password': {'write_only': True}}
        # if u want to keep the password exposed add a tab infroont of create function to include it insside Meta

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


User = get_user_model()


class UserDOTPermissionSerializer(serializers.ModelSerializer):
    """Serializer for user DOT permissions"""
    class Meta:
        model = UserDOTPermission
        fields = ['id', 'dot_code', 'dot_name', 'created_at']
        read_only_fields = ['created_at']


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    birthday = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False)
    dot_permissions = UserDOTPermissionSerializer(many=True, read_only=True)
    authorized_dots = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "first_name",
            "last_name", "birthday", "profile_picture",
            "password", "role", "dot_permissions", "authorized_dots"
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_birthday(self, obj):
        return obj.birthday.strftime("%Y-%m-%d") if obj.birthday else ""

    def get_authorized_dots(self, obj):
        return obj.get_authorized_dots()

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance


class CustomPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class UserManagementSerializer(serializers.ModelSerializer):
    groups = serializers.StringRelatedField(many=True, read_only=True)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES)
    password = serializers.CharField(write_only=True, required=False)
    dot_permissions = UserDOTPermissionSerializer(many=True, read_only=True)
    authorized_dots = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'password', 'first_name', 'last_name',
            'is_active', 'is_staff', 'date_joined', 'groups',
            'role', 'last_login', 'dot_permissions', 'authorized_dots'
        ]
        read_only_fields = ['date_joined', 'last_login']

    def get_authorized_dots(self, obj):
        return obj.get_authorized_dots()

    def validate_email(self, value):
        try:
            validate_email(value)
        except ValidationError:
            raise serializers.ValidationError("Invalid email format.")
        return value.lower()

    def validate_password(self, value):
        if value:
            try:
                validate_password_strength(value)
            except ValidationError as e:
                raise serializers.ValidationError(str(e))
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        # Only superusers can create admin users
        if (attrs.get('role') == 'admin' and
                not request.user.is_superuser):
            raise serializers.ValidationError(
                "Only superusers can create admin users."
            )
        return attrs

    def create(self, validated_data):
        """
        Create a new user with proper error handling
        """
        try:
            # Use create_user instead of the default create
            user = User.objects.create_user(**validated_data)

            # Log admin action
            request = self.context.get('request')
            if request and request.user:
                log_admin_action(
                    request.user,
                    'create_user',
                    target=user.email,
                    details=f"Role: {user.role}"
                )
            return user
        except Exception as e:
            # Log the error
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error creating user: {str(e)}")

            # Convert Django validation errors to DRF validation errors
            if hasattr(e, 'message_dict'):
                from rest_framework.exceptions import ValidationError
                raise ValidationError(e.message_dict)

            # Re-raise the exception
            raise

    def update(self, instance, validated_data):
        # Handle password updates separately
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)

        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        # Log changes
        request = self.context.get('request')
        if request and request.user:
            changes = []
            if password:
                changes.append("Password updated")
            if 'role' in validated_data:
                changes.append(f"Role changed to {instance.role}")

            if changes:
                log_admin_action(
                    request.user,
                    'update_user',
                    target=instance.email,
                    details=", ".join(changes)
                )

        return instance


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'is_staff', 'is_superuser']


class DOTPermissionAssignmentSerializer(serializers.Serializer):
    """Serializer for assigning DOT permissions to a user"""
    dot_code = serializers.CharField(required=True)
    dot_name = serializers.CharField(required=True)

    def validate(self, attrs):
        # Ensure dot_code is not empty
        if not attrs.get('dot_code'):
            raise serializers.ValidationError(
                {"dot_code": ["DOT code cannot be empty"]})
        # Ensure dot_name is not empty
        if not attrs.get('dot_name'):
            raise serializers.ValidationError(
                {"dot_name": ["DOT name cannot be empty"]})
        return attrs

    class Meta:
        # Explicitly define fields to prevent inheriting from other serializers
        fields = ['dot_code', 'dot_name']
