from rest_framework import serializers
from django.utils import timezone
from django.db.models import Q
from login_manager.models import User
from system_layout.models import LayoutItem, Lab, System, LabAssignment, PrivilegesConfig, SYSTEM_TYPES, ALLOWED_CHILDREN
from faults.models import FaultReport
from resources.models import ResourceRequest
from monitoring.models import SystemInfo
from api_v1.models import Notification


# ─── Auth ───────────────────────────────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    assigned_labs = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'is_staff', 'is_superuser', 'date_joined', 'last_login', 'assigned_labs']
        read_only_fields = ['id', 'date_joined', 'last_login', 'is_staff', 'is_superuser']

    def get_assigned_labs(self, obj):
        if obj.role not in ('Lab Incharge', 'Lab Assistant'):
            return []
        # ponytail: per-user query; fine at campus scale + list endpoint is cached 5 min.
        return list(
            LabAssignment.get_active_labs_for_user(obj)
            .values_list('lab__lab_name', flat=True)
        )


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['role', 'email']


class NotificationSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'created_by', 'created_by_username', 'recipient',
            'message', 'related_to', 'related_id', 'target_url', 'is_read', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'created_by', 'recipient']


class AdminNotificationCreateSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000)
    recipient_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, allow_empty=False,
    )
    send_to_all = serializers.BooleanField(required=False, default=False)
    target_url = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        if not attrs.get('send_to_all') and not attrs.get('recipient_ids'):
            raise serializers.ValidationError('Provide recipient_ids or set send_to_all=true.')
        return attrs


# ─── Layout ─────────────────────────────────────────────────────────────────

class LayoutItemSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    quick_info = serializers.SerializerMethodField()
    parent_name = serializers.SerializerMethodField()
    monitoring_status = serializers.SerializerMethodField()
    alert_status = serializers.SerializerMethodField()

    class Meta:
        model = LayoutItem
        fields = [
            'id', 'name', 'item_type', 'parent', 'parent_name',
            'position_x', 'position_y', 'width', 'height',
            'created_at', 'updated_at', 'status', 'quick_info', 'monitoring_status', 'alert_status',
        ]

    def get_status(self, obj):
        if obj.item_type in SYSTEM_TYPES:
            system = getattr(obj, 'system', None)
            if system is None:
                return None
            monitored = self.context.get('monitored_hostnames', set())
            if system.host_name and system.host_name.lower() in monitored:
                return 'active'
            return system.status
        return None

    def get_quick_info(self, obj):
        if obj.item_type == 'room':
            lab = getattr(obj, 'lab', None)
            return lab.get_quick_info() if lab else {}
        return None

    def get_parent_name(self, obj):
        return obj.parent.name if obj.parent else None

    def get_monitoring_status(self, obj):
        if obj.item_type not in SYSTEM_TYPES:
            return None
        system = getattr(obj, 'system', None)
        if system is None or not system.host_name:
            return None
        monitored = self.context.get('monitored_hostnames', set())
        return 'online' if system.host_name.lower() in monitored else None

    def get_alert_status(self, obj):
        if obj.item_type not in SYSTEM_TYPES:
            return None

        active_fault_ids = self.context.get('active_fault_layout_ids', set())
        pending_resource_ids = self.context.get('pending_resource_layout_ids', set())

        # Frontend color priority: fault (red) > resource (blue) > monitoring (green) > grey.
        if obj.id in active_fault_ids:
            return 'fault_active'
        if obj.id in pending_resource_ids:
            return 'resource_pending'
        return None


class LayoutItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LayoutItem
        fields = ['name', 'item_type', 'parent', 'position_x', 'position_y', 'width', 'height']

    def validate(self, attrs):
        parent = attrs.get('parent')
        parent_type = parent.item_type if parent else None
        allowed = ALLOWED_CHILDREN.get(parent_type)
        if allowed is None:
            raise serializers.ValidationError(
                {'parent': f"A {parent.get_item_type_display()} cannot contain child items."}
            )
        item_type = attrs.get('item_type')
        if item_type not in allowed:
            location = f"a {parent.get_item_type_display()}" if parent else "the root level"
            raise serializers.ValidationError(
                {'item_type': f"'{item_type}' is not allowed inside {location}. "
                              f"Allowed here: {', '.join(allowed)}."}
            )
        return attrs


class LayoutItemUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LayoutItem
        fields = ['name', 'position_x', 'position_y', 'width', 'height']


class SystemSerializer(serializers.ModelSerializer):
    layout_item_name = serializers.CharField(source='layout_item.name', read_only=True)
    layout_item_type = serializers.CharField(source='layout_item.item_type', read_only=True)
    lab_name = serializers.CharField(source='lab.lab_name', read_only=True)
    updated_by_username = serializers.CharField(source='updated_by.username', read_only=True)

    class Meta:
        model = System
        fields = [
            'id', 'layout_item', 'layout_item_name', 'layout_item_type',
            'lab', 'lab_name', 'host_name', 'status', 'updated_at', 'updated_by_username',
        ]
        read_only_fields = ['id', 'layout_item', 'lab', 'updated_at']


class LabSerializer(serializers.ModelSerializer):
    instructors = UserSerializer(many=True, read_only=True)
    assistants = UserSerializer(many=True, read_only=True)
    layout_item_id = serializers.IntegerField(source='layout_item.id', read_only=True)
    layout_item_name = serializers.CharField(source='layout_item.name', read_only=True)
    floor_id = serializers.SerializerMethodField()
    parent_name = serializers.SerializerMethodField()
    building_name = serializers.SerializerMethodField()
    # Populated via Count('system', distinct=True) annotation in the view
    systems_count = serializers.IntegerField(read_only=True)
    current_incharge = serializers.SerializerMethodField()
    current_assistant = serializers.SerializerMethodField()

    class Meta:
        model = Lab
        fields = [
            'id', 'lab_name', 'lab_code', 'location', 'capacity', 'dimension',
            'quick_info', 'instructors', 'assistants',
            'layout_item_id', 'layout_item_name', 'floor_id', 'parent_name', 'building_name', 'systems_count',
            'current_incharge', 'current_assistant',
        ]

    def get_floor_id(self, obj):
        try:
            return obj.layout_item.parent.id
        except AttributeError:
            return None

    def get_parent_name(self, obj):
        # layout_item__parent is already select_related in the view
        if obj.layout_item and obj.layout_item.parent:
            return obj.layout_item.parent.name
        return None

    def get_building_name(self, obj):
        # layout_item__parent__parent is select_related in the view
        try:
            return obj.layout_item.parent.parent.name
        except AttributeError:
            return None

    def get_systems_count(self, obj):
        # Fall back to a direct count only if annotation is absent (e.g. detail view)
        return getattr(obj, 'systems_count', None) or System.objects.filter(lab=obj).count()

    def _assignment_data(self, obj, role_type):
        """Return current active assignment for a role, using prefetch cache when available."""
        today = timezone.now().date()
        # Use prefetched queryset (no extra DB hit when prefetch_related is set in the view)
        for a in obj.assignments.all():
            if a.role_type != role_type:
                continue
            if a.start_date and a.start_date > today:
                continue
            if a.end_date and a.end_date < today:
                continue
            return {
                'assignment_id': a.id,
                'user_id': a.user_id,
                'username': a.user.username,
                'start_date': a.start_date,
                'end_date': a.end_date,
            }
        return None

    def get_current_incharge(self, obj):
        return self._assignment_data(obj, LabAssignment.ROLE_INCHARGE)

    def get_current_assistant(self, obj):
        return self._assignment_data(obj, LabAssignment.ROLE_ASSISTANT)


# ─── Lab Assignments & Privileges Config ────────────────────────────────────

class LabAssignmentSerializer(serializers.ModelSerializer):
    lab_name = serializers.CharField(source='lab.lab_name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    assigned_by_username = serializers.CharField(source='assigned_by.username', read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = LabAssignment
        fields = [
            'id', 'lab', 'lab_name', 'user', 'username', 'user_email',
            'role_type', 'assigned_by', 'assigned_by_username',
            'assigned_at', 'start_date', 'end_date', 'is_active',
        ]
        read_only_fields = ['id', 'assigned_at', 'assigned_by']


class LabAssignmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabAssignment
        fields = ['lab', 'user', 'role_type', 'start_date', 'end_date']


class PrivilegesConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivilegesConfig
        fields = [
            'max_labs_per_incharge', 'max_labs_per_assistant',
            'max_incharges_per_lab', 'max_assistants_per_lab',
        ]


class LabUpdateSerializer(serializers.ModelSerializer):
    instructor_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    assistant_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = Lab
        fields = ['lab_name', 'lab_code', 'location', 'capacity', 'dimension', 'quick_info',
                  'instructor_ids', 'assistant_ids']

    def update(self, instance, validated_data):
        instructor_ids = validated_data.pop('instructor_ids', None)
        assistant_ids = validated_data.pop('assistant_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if instructor_ids is not None:
            instance.instructors.set(User.objects.filter(id__in=instructor_ids))
        if assistant_ids is not None:
            instance.assistants.set(User.objects.filter(id__in=assistant_ids))
        return instance


# ─── Faults ─────────────────────────────────────────────────────────────────

class FaultReportSerializer(serializers.ModelSerializer):
    system_host_name = serializers.CharField(source='system_name.host_name', read_only=True)
    lab_name = serializers.CharField(source='system_name.lab.lab_name', read_only=True, allow_null=True)
    reported_by_username = serializers.CharField(source='reported_by.username', read_only=True)
    # Nest resolution data to keep frontend response shape identical
    resolved = serializers.SerializerMethodField()

    class Meta:
        model = FaultReport
        fields = [
            'fault_id', 'system_name', 'system_host_name', 'lab_name',
            'reported_by', 'reported_by_username', 'fault_type',
            'risk_factor', 'description', 'status', 'reported_at', 'resolved',
        ]
        read_only_fields = ['fault_id', 'reported_at', 'reported_by']

    def get_resolved(self, obj):
        if obj.status == 'resolved' and obj.resolved_at:
            return {
                'resolution_summary': obj.resolution_summary,
                'resolved_by_username': obj.resolved_by.username if obj.resolved_by_id else None,
                'resolved_at': obj.resolved_at.isoformat(),
            }
        return None


class FaultReportCreateSerializer(serializers.ModelSerializer):
    system_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = FaultReport
        fields = ['system_id', 'fault_type', 'risk_factor', 'description']

    def create(self, validated_data):
        system = System.objects.get(id=validated_data.pop('system_id'))
        return FaultReport.objects.create(
            system_name=system,
            reported_by=self.context['request'].user,
            **validated_data,
        )


class FaultStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=FaultReport.STATUS_CHOICES)
    resolution_summary = serializers.CharField(required=False, allow_blank=True)


# ─── Resources ───────────────────────────────────────────────────────────────

class ResourceRequestSerializer(serializers.ModelSerializer):
    system_host_name = serializers.CharField(source='system_name.host_name', read_only=True)
    lab_name = serializers.CharField(source='system_name.lab.lab_name', read_only=True, allow_null=True)
    requested_by_username = serializers.CharField(source='requested_by.username', read_only=True)
    # Nest provision data to keep frontend response shape identical
    provided = serializers.SerializerMethodField()

    line_total = serializers.SerializerMethodField()

    class Meta:
        model = ResourceRequest
        fields = [
            'resource_id', 'system_name', 'system_host_name', 'lab_name',
            'requested_by', 'requested_by_username',
            'resource_name', 'description', 'quantity', 'cost', 'line_total',
            'status', 'requested_at', 'provided',
        ]
        read_only_fields = ['resource_id', 'requested_at', 'requested_by']

    def get_line_total(self, obj):
        if obj.cost is None:
            return None
        return float(obj.cost) * obj.quantity

    def get_provided(self, obj):
        if obj.status == 'Fulfilled' and obj.provided_at:
            return {
                'provision_summary': obj.provision_summary,
                'provided_by_username': obj.provided_by.username if obj.provided_by_id else None,
                'provided_at': obj.provided_at.isoformat(),
            }
        return None


class ResourceCreateSerializer(serializers.ModelSerializer):
    system_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = ResourceRequest
        fields = ['system_id', 'resource_name', 'description', 'quantity']

    def create(self, validated_data):
        system = System.objects.get(id=validated_data.pop('system_id'))
        return ResourceRequest.objects.create(
            system_name=system,
            requested_by=self.context['request'].user,
            **validated_data,
        )


class ResourceStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ResourceRequest.STATUS_CHOICES)
    provision_summary = serializers.CharField(required=False, allow_blank=True)
    cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, min_value=0)
    quantity = serializers.IntegerField(required=False, min_value=1)


# ─── Monitoring ──────────────────────────────────────────────────────────────

class SystemInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemInfo
        fields = [
            'id',
            'hostname', 'ip_address', 'system', 'version', 'release', 'machine',
            'processor', 'architecture', 'cpu_physical_cores', 'cpu_total_cores',
            'cpu_max_freq', 'cpu_min_freq', 'cpu_current_freq', 'cpu_usage', 'cpu_load_avg',
            'memory_total', 'memory_available', 'memory_used', 'memory_usage_percent',
            'swap_total', 'swap_used', 'swap_usage_percent',
            'disk_total', 'disk_used', 'disk_free', 'disk_usage_percent',
            'disk_read_bytes', 'disk_write_bytes',
            'bytes_sent', 'bytes_received', 'top_processes',
            'users_count', 'logged_in_users', 'gpu_available', 'gpu_stats', 'timestamp'
        ]
