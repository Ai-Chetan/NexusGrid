from django.contrib.auth import authenticate, login, logout
from django.db.models import Count, Case, When, IntegerField, Q
from django.utils import timezone
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination

from login_manager.models import User
from system_layout.models import LayoutItem, Lab, System
from faults.models import FaultReport
from resources.models import ResourceRequest
from monitoring.models import SystemInfo

from .serializers import (
    UserSerializer, UserUpdateSerializer,
    LayoutItemSerializer, LayoutItemCreateSerializer, LayoutItemUpdateSerializer,
    SystemSerializer, LabSerializer, LabUpdateSerializer,
    FaultReportSerializer, FaultReportCreateSerializer, FaultStatusUpdateSerializer,
    ResourceRequestSerializer, ResourceCreateSerializer, ResourceStatusUpdateSerializer,
    SystemInfoSerializer,
)


# ─── Pagination ──────────────────────────────────────────────────────────────

class StandardPagination(PageNumberPagination):
    page_size = 15
    max_page_size = 100
    page_size_query_param = 'page_size'

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'page': self.page.number,
            'page_size': self.get_page_size(self.request),
            'total_pages': self.page.paginator.num_pages,
            'results': data,
        })


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()
        user = authenticate(request, username=username, password=password)
        if user is None:
            try:
                u = User.objects.get(email=username)
                user = authenticate(request, username=u.username, password=password)
            except User.DoesNotExist:
                pass
        if user:
            login(request, user)
            return Response({'user': UserSerializer(user).data})
        return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError

        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        confirm_password = request.data.get('confirm_password', '')

        errors = {}

        if not username or len(username) < 3:
            errors['username'] = 'Username must be at least 3 characters.'
        elif User.objects.filter(username__iexact=username).exists():
            errors['username'] = 'This username is already taken.'

        if not email:
            errors['email'] = 'Email is required.'
        else:
            try:
                validate_email(email)
            except DjangoValidationError:
                errors['email'] = 'Enter a valid email address.'
            else:
                if User.objects.filter(email__iexact=email).exists():
                    errors['email'] = 'An account with this email already exists.'

        if not password or len(password) < 8:
            errors['password'] = 'Password must be at least 8 characters.'
        elif password != confirm_password:
            errors['confirm_password'] = 'Passwords do not match.'

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role='Students',
        )
        login(request, user)
        return Response({'user': UserSerializer(user).data}, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({'detail': 'Logged out.'})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'user': UserSerializer(request.user).data})


# ─── Dashboard ───────────────────────────────────────────────────────────────

class DashboardMetricsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .services.metrics import get_dashboard_metrics
        return Response(get_dashboard_metrics())


# ─── Layout ──────────────────────────────────────────────────────────────────

class LayoutItemsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        parent_id = request.GET.get('parent_id')
        parent_id = int(parent_id) if parent_id and parent_id.isdigit() else None
        qs = LayoutItem.objects.select_related('system', 'lab')
        items = qs.filter(parent_id=parent_id) if parent_id else qs.filter(parent__isnull=True)
        return Response(LayoutItemSerializer(items, many=True).data)

    def post(self, request):
        ser = LayoutItemCreateSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        from django.db import transaction
        with transaction.atomic():
            item = ser.save()
            if item.item_type == 'room':
                ancestors = item.get_ancestors()
                location = " > ".join(a.name for a in ancestors) or "Unknown"
                Lab.objects.create(layout_item=item, lab_name=item.name, location=location)
            elif item.item_type in ['computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack']:
                # Was: N+1 while loop walking item.parent one step at a time.
                # Now: 1 CTE query to fetch ancestor IDs + 1 query to find the
                # nearest ancestor that owns a Lab (rooms have labs; floors/
                # buildings do not).  Closest ancestor = last in the root-first list.
                parent_lab = None
                ancestors = item.get_ancestors()  # 1 CTE query
                if ancestors:
                    ancestor_ids = [a.id for a in ancestors]
                    labs_by_item = {
                        lab.layout_item_id: lab
                        for lab in Lab.objects.filter(layout_item_id__in=ancestor_ids)  # 1 query
                    }
                    # Walk closest-to-root reversed so we pick the nearest room
                    for aid in reversed(ancestor_ids):
                        if aid in labs_by_item:
                            parent_lab = labs_by_item[aid]
                            break
                System.objects.create(
                    layout_item=item, lab=parent_lab,
                    host_name=item.name, updated_at=timezone.now(),
                    updated_by=request.user,
                )
        return Response(LayoutItemSerializer(item).data, status=201)


class LayoutItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        item = get_object_or_404(LayoutItem.objects.select_related('system', 'lab'), pk=pk)
        return Response(LayoutItemSerializer(item).data)

    def patch(self, request, pk):
        from django.db import transaction
        item = get_object_or_404(LayoutItem, pk=pk)
        ser = LayoutItemUpdateSerializer(item, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        with transaction.atomic():
            old_name = item.name
            ser.save()
            name_changed = item.name != old_name
            if item.item_type == 'room' and name_changed:
                lab = getattr(item, 'lab', None)
                if lab:
                    lab.lab_name = item.name
                    lab.save(update_fields=['lab_name'])
            if item.item_type in ['computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack']:
                system = getattr(item, 'system', None)
                if system and name_changed:
                    system.host_name = item.name
                    system.updated_at = timezone.now()
                    system.updated_by = request.user
                    system.save(update_fields=['host_name', 'updated_at', 'updated_by_id'])
        return Response(LayoutItemSerializer(item).data)

    def delete(self, request, pk):
        item = get_object_or_404(LayoutItem, pk=pk)
        item.delete()
        return Response(status=204)


class LayoutBreadcrumbView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        # Single CTE query: fetches the node itself + all ancestors, root-first.
        # Was: get_object_or_404 (1 query) + get_ancestors() while-loop (N queries).
        crumbs = LayoutItem.get_breadcrumb(pk)
        if not crumbs:
            return Response({'detail': 'Not found.'}, status=404)
        return Response(
            [{'id': a.id, 'name': a.name, 'item_type': a.item_type} for a in crumbs]
        )


class SystemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        system = get_object_or_404(System.objects.select_related('layout_item', 'lab', 'updated_by'), pk=pk)
        return Response(SystemSerializer(system).data)

    def patch(self, request, pk):
        system = get_object_or_404(System, pk=pk)
        new_status = request.data.get('status')
        if new_status and new_status not in dict(System.STATUS_CHOICES):
            return Response({'detail': 'Invalid status.'}, status=400)
        if new_status:
            system.status = new_status
        system.updated_at = timezone.now()
        system.updated_by = request.user
        system.save(update_fields=['status', 'updated_at', 'updated_by_id'])
        return Response(SystemSerializer(system).data)


class LabListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        labs = (
            Lab.objects
            .select_related('layout_item', 'layout_item__parent')
            .prefetch_related('instructors', 'assistants')
            .annotate(systems_count=Count('system', distinct=True))
        )
        return Response(LabSerializer(labs, many=True).data)


class LabDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        lab = get_object_or_404(
            Lab.objects
            .select_related('layout_item', 'layout_item__parent')
            .prefetch_related('instructors', 'assistants')
            .annotate(systems_count=Count('system', distinct=True)),
            pk=pk,
        )
        return Response(LabSerializer(lab).data)

    def patch(self, request, pk):
        lab = get_object_or_404(Lab, pk=pk)
        ser = LabUpdateSerializer(lab, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        ser.save()
        lab.refresh_from_db()
        return Response(LabSerializer(lab).data)


# ─── Faults ──────────────────────────────────────────────────────────────────

class FaultListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = FaultReport.objects.select_related('system_name', 'system_name__lab', 'reported_by', 'resolved_by')
        q = request.GET.get('search', '').strip()
        s = request.GET.get('status', '').strip()
        t = request.GET.get('time', '').strip()
        sort = request.GET.get('sort', 'newest')

        if q:
            qs = qs.filter(
                Q(system_name__host_name__icontains=q) |
                Q(system_name__lab__lab_name__icontains=q) |
                Q(fault_type__icontains=q) |
                Q(description__icontains=q)
            )
        if s and s != 'all':
            qs = qs.filter(status=s)
        if t and t != 'all':
            now = timezone.now()
            if t == 'today':
                qs = qs.filter(reported_at__date=now.date())
            elif t == 'week':
                qs = qs.filter(reported_at__gte=now - timezone.timedelta(days=7))
            elif t == 'month':
                qs = qs.filter(reported_at__gte=now - timezone.timedelta(days=30))
        start = request.GET.get('start')
        end = request.GET.get('end')
        if start:
            qs = qs.filter(reported_at__date__gte=start)
        if end:
            qs = qs.filter(reported_at__date__lte=end)

        qs = qs.order_by('reported_at' if sort == 'oldest' else '-reported_at')
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(FaultReportSerializer(page, many=True).data)

    def post(self, request):
        ser = FaultReportCreateSerializer(data=request.data, context={'request': request})
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        fault = ser.save()
        return Response(FaultReportSerializer(fault).data, status=201)


class FaultDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        fault = get_object_or_404(
            FaultReport.objects.select_related('system_name', 'system_name__lab', 'reported_by', 'resolved_by'),
            pk=pk,
        )
        return Response(FaultReportSerializer(fault).data)

    def patch(self, request, pk):
        fault = get_object_or_404(FaultReport, pk=pk)
        ser = FaultStatusUpdateSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        new_status = ser.validated_data['status']
        resolution_summary = ser.validated_data.get('resolution_summary', '')
        fault.status = new_status
        update_fields = ['status']
        if new_status == 'resolved' and resolution_summary:
            fault.resolution_summary = resolution_summary
            fault.resolved_by = request.user
            fault.resolved_at = timezone.now()
            update_fields += ['resolution_summary', 'resolved_by', 'resolved_at']
        fault.save(update_fields=update_fields)
        fault.refresh_from_db()
        return Response(FaultReportSerializer(fault).data)


# ─── Resources ───────────────────────────────────────────────────────────────

class ResourceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ResourceRequest.objects.select_related('system_name', 'system_name__lab', 'requested_by', 'provided_by')
        q = request.GET.get('search', '').strip()
        s = request.GET.get('status', '').strip()
        t = request.GET.get('time', '').strip()
        sort = request.GET.get('sort', 'newest')

        if q:
            qs = qs.filter(
                Q(system_name__host_name__icontains=q) |
                Q(system_name__lab__lab_name__icontains=q) |
                Q(resource_name__icontains=q) |
                Q(description__icontains=q)
            )
        if s and s != 'all':
            qs = qs.filter(status__iexact=s)
        if t and t != 'all':
            now = timezone.now()
            if t == 'today':
                qs = qs.filter(requested_at__date=now.date())
            elif t == 'week':
                qs = qs.filter(requested_at__gte=now - timezone.timedelta(days=7))
            elif t == 'month':
                qs = qs.filter(requested_at__gte=now - timezone.timedelta(days=30))
        start = request.GET.get('start')
        end = request.GET.get('end')
        if start:
            qs = qs.filter(requested_at__date__gte=start)
        if end:
            qs = qs.filter(requested_at__date__lte=end)

        qs = qs.order_by('requested_at' if sort == 'oldest' else '-requested_at')
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(ResourceRequestSerializer(page, many=True).data)

    def post(self, request):
        ser = ResourceCreateSerializer(data=request.data, context={'request': request})
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        res = ser.save()
        return Response(ResourceRequestSerializer(res).data, status=201)


class ResourceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        resource = get_object_or_404(ResourceRequest, pk=pk)
        ser = ResourceStatusUpdateSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        new_status = ser.validated_data['status']
        provision_summary = ser.validated_data.get('provision_summary', '')
        resource.status = new_status
        update_fields = ['status']
        if new_status == 'Fulfilled' and provision_summary:
            resource.provision_summary = provision_summary
            resource.provided_by = request.user
            resource.provided_at = timezone.now()
            update_fields += ['provision_summary', 'provided_by', 'provided_at']
        resource.save(update_fields=update_fields)
        resource.refresh_from_db()
        return Response(ResourceRequestSerializer(resource).data)


# ─── Reports ─────────────────────────────────────────────────────────────────

class ReportsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .services.metrics import get_report_metrics
        return Response(get_report_metrics())


# ─── Monitoring ──────────────────────────────────────────────────────────────

MONITORING_CACHE_KEY = 'monitoring_latest_v1'
MONITORING_CACHE_TTL = 30  # seconds — matches the frontend 30s polling interval


class MonitoringView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.core.cache import cache
        cached = cache.get(MONITORING_CACHE_KEY)
        if cached is not None:
            return Response(cached)
        infos = SystemInfo.objects.order_by('hostname')
        data = {'systems': SystemInfoSerializer(infos, many=True).data}
        cache.set(MONITORING_CACHE_KEY, data, MONITORING_CACHE_TTL)
        return Response(data)


# ─── Users ───────────────────────────────────────────────────────────────────

USER_LIST_CACHE_KEY = 'user_list_v1'
USER_LIST_CACHE_TTL = 60 * 5  # 5 minutes


class UserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.core.cache import cache
        cached = cache.get(USER_LIST_CACHE_KEY)
        if cached is not None:
            return Response(cached)
        users = User.objects.all()
        data = UserSerializer(users, many=True).data
        cache.set(USER_LIST_CACHE_KEY, data, USER_LIST_CACHE_TTL)
        return Response(data)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        ser = UserUpdateSerializer(user, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        ser.save()
        # Bust the cached user list
        from django.core.cache import cache
        cache.delete(USER_LIST_CACHE_KEY)
        return Response(UserSerializer(user).data)


class SystemsListView(APIView):
    """Return all systems for dropdowns."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        systems = System.objects.select_related('lab', 'layout_item').all()
        data = [
            {
                'id': s.id,
                'host_name': s.host_name or (s.layout_item.name if s.layout_item else 'Unknown'),
                'lab_name': s.lab.lab_name if s.lab else None,
                'status': s.status,
            }
            for s in systems
        ]
        return Response(data)


class UserPrivilegesStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_counts = User.objects.aggregate(
            total_users=Count('id'),
            unassigned_users=Count(Case(When(role='No Roles', then=1), output_field=IntegerField())),
        )
        return Response({
            **user_counts,
            'total_labs': Lab.objects.count(),
            'labs_without_instructor': Lab.objects.filter(instructors__isnull=True).count(),
            'labs_without_assistant': Lab.objects.filter(assistants__isnull=True).count(),
        })
