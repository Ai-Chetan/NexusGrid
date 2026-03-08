from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api_v1.feature_permissions import require_feature
from api_v1.throttles import RbacMutationUserThrottle
from rbac.models import Permission, Role, RolePermission, UserRole
from rbac.permissions import IsTenantSuperuser
from rbac.serializers import (
    PermissionSerializer,
    RoleCreateSerializer,
    RolePermissionUpdateSerializer,
    RoleSerializer,
    UserSummarySerializer,
    UserRoleUpdateSerializer,
)
from tenant_control.services.audit import record_audit_event


class PermissionListView(APIView):
    permission_classes = [IsAuthenticated, require_feature('rbac')]

    def get(self, request):
        queryset = Permission.objects.all()
        module = request.query_params.get("module")
        if module:
            queryset = queryset.filter(module=module)
        return Response(PermissionSerializer(queryset, many=True).data)


class RoleListCreateView(APIView):
    permission_classes = [IsAuthenticated, require_feature('rbac'), IsTenantSuperuser]
    throttle_classes = [RbacMutationUserThrottle]

    def get(self, request):
        return Response(RoleSerializer(Role.objects.all(), many=True).data)

    def post(self, request):
        serializer = RoleCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        role = serializer.save()
        record_audit_event(
            category="rbac",
            action="role.created",
            source="api",
            actor_user=request.user,
            object_type="Role",
            object_id=str(role.id),
            payload={"name": role.name},
        )
        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)


class RoleDetailView(APIView):
    permission_classes = [IsAuthenticated, require_feature('rbac'), IsTenantSuperuser]
    throttle_classes = [RbacMutationUserThrottle]

    def get(self, request, pk):
        role = get_object_or_404(Role, pk=pk)
        return Response(RoleSerializer(role).data)

    def patch(self, request, pk):
        role = get_object_or_404(Role, pk=pk)
        if role.is_system:
            return Response({"detail": "System roles cannot be modified."}, status=status.HTTP_400_BAD_REQUEST)

        name = request.data.get("name")
        description = request.data.get("description")
        updates = []
        if name is not None:
            role.name = str(name).strip()
            updates.append("name")
        if description is not None:
            role.description = str(description)
            updates.append("description")
        if updates:
            updates.append("updated_at")
            role.save(update_fields=updates)
            record_audit_event(
                category="rbac",
                action="role.updated",
                source="api",
                actor_user=request.user,
                object_type="Role",
                object_id=str(role.id),
                payload={"updated_fields": updates},
            )
        return Response(RoleSerializer(role).data)

    def delete(self, request, pk):
        role = get_object_or_404(Role, pk=pk)
        if role.is_system:
            return Response({"detail": "System roles cannot be deleted."}, status=status.HTTP_400_BAD_REQUEST)
        if role.role_users.exists():
            return Response({"detail": "Cannot delete role assigned to users."}, status=status.HTTP_400_BAD_REQUEST)
        role_id = role.id
        role_name = role.name
        role.delete()
        record_audit_event(
            category="rbac",
            action="role.deleted",
            source="api",
            actor_user=request.user,
            object_type="Role",
            object_id=str(role_id),
            payload={"name": role_name},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class RolePermissionsView(APIView):
    permission_classes = [IsAuthenticated, require_feature('rbac'), IsTenantSuperuser]
    throttle_classes = [RbacMutationUserThrottle]

    def put(self, request, pk):
        role = get_object_or_404(Role, pk=pk)
        serializer = RolePermissionUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        codes = serializer.validated_data["permission_codes"]
        perms = list(Permission.objects.filter(code__in=codes))
        found_codes = {p.code for p in perms}
        missing = sorted(set(codes) - found_codes)
        if missing:
            return Response({"detail": "Unknown permission codes.", "missing": missing}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            RolePermission.objects.filter(role=role).exclude(permission__code__in=codes).delete()
            existing_permission_ids = set(
                RolePermission.objects.filter(role=role, permission__code__in=codes).values_list("permission_id", flat=True)
            )
            to_create = [
                RolePermission(role=role, permission=perm)
                for perm in perms
                if perm.id not in existing_permission_ids
            ]
            if to_create:
                RolePermission.objects.bulk_create(to_create)

        record_audit_event(
            category="rbac",
            action="role.permissions_updated",
            source="api",
            actor_user=request.user,
            object_type="Role",
            object_id=str(role.id),
            payload={"permission_codes": codes},
        )

        return Response(RoleSerializer(role).data)


class UserRoleAssignmentsView(APIView):
    permission_classes = [IsAuthenticated, require_feature('rbac'), IsTenantSuperuser]
    throttle_classes = [RbacMutationUserThrottle]

    def get(self, request, user_id):
        User = get_user_model()
        user = get_object_or_404(User, pk=user_id)
        return Response(UserSummarySerializer(user).data)

    def put(self, request, user_id):
        User = get_user_model()
        user = get_object_or_404(User, pk=user_id)
        serializer = UserRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role_ids = serializer.validated_data["role_ids"]

        roles = list(Role.objects.filter(id__in=role_ids))
        found_ids = {r.id for r in roles}
        missing = sorted(set(role_ids) - found_ids)
        if missing:
            return Response({"detail": "Unknown role ids.", "missing": missing}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            UserRole.objects.filter(user=user).exclude(role_id__in=role_ids).delete()
            existing_role_ids = set(UserRole.objects.filter(user=user, role_id__in=role_ids).values_list("role_id", flat=True))
            to_create = [
                UserRole(user=user, role=role, assigned_by=request.user)
                for role in roles
                if role.id not in existing_role_ids
            ]
            if to_create:
                UserRole.objects.bulk_create(to_create)

        record_audit_event(
            category="rbac",
            action="user.roles_updated",
            source="api",
            actor_user=request.user,
            object_type="User",
            object_id=str(user.id),
            payload={"role_ids": role_ids},
        )

        user.refresh_from_db()
        return Response(UserSummarySerializer(user).data)
