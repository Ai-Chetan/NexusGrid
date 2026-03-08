from rest_framework import serializers

from login_manager.models import User
from rbac.models import Permission, Role, RolePermission, UserRole


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "module", "action", "description"]


class RoleSerializer(serializers.ModelSerializer):
    permission_codes = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ["id", "name", "description", "is_system", "created_by", "created_at", "updated_at", "permission_codes"]
        read_only_fields = ["id", "is_system", "created_by", "created_at", "updated_at", "permission_codes"]

    def get_permission_codes(self, obj):
        return list(obj.role_permissions.values_list("permission__code", flat=True))


class RoleCreateSerializer(serializers.ModelSerializer):
    permission_codes = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)

    class Meta:
        model = Role
        fields = ["name", "description", "permission_codes"]

    def create(self, validated_data):
        permission_codes = validated_data.pop("permission_codes", [])
        request = self.context.get("request")
        role = Role.objects.create(created_by=request.user if request else None, **validated_data)
        if permission_codes:
            permissions = Permission.objects.filter(code__in=permission_codes)
            RolePermission.objects.bulk_create(
                [RolePermission(role=role, permission=perm) for perm in permissions],
                ignore_conflicts=True,
            )
        return role


class RolePermissionUpdateSerializer(serializers.Serializer):
    permission_codes = serializers.ListField(child=serializers.CharField(), allow_empty=True)


class UserRoleSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = UserRole
        fields = ["id", "user", "role", "role_name", "assigned_by", "assigned_at"]
        read_only_fields = ["id", "assigned_by", "assigned_at", "role_name"]


class UserRoleUpdateSerializer(serializers.Serializer):
    role_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=True)


class UserSummarySerializer(serializers.ModelSerializer):
    role_ids = serializers.SerializerMethodField()
    role_names = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "role_ids", "role_names"]

    def get_role_ids(self, obj):
        return list(obj.rbac_roles.values_list("role_id", flat=True))

    def get_role_names(self, obj):
        return list(obj.rbac_roles.values_list("role__name", flat=True))
