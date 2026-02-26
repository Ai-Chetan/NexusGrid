from django.contrib.auth import authenticate, login, logout
from django.db.models import Count, Case, When, IntegerField, Max, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.middleware.csrf import get_token

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes

from login_manager.models import User
from system_layout.models import LayoutItem, Lab, System
from faults.models import FaultReport, Resolved
from resources.models import ResourceRequest, Provided
from monitoring.models import SystemInfo

from .serializers import (
    UserSerializer, UserUpdateSerializer,
    LayoutItemSerializer, LayoutItemCreateSerializer, LayoutItemUpdateSerializer,
    SystemSerializer, LabSerializer, LabUpdateSerializer,
    FaultReportSerializer, FaultReportCreateSerializer, FaultStatusUpdateSerializer,
    ResourceRequestSerializer, ResourceCreateSerializer, ResourceStatusUpdateSerializer,
    SystemInfoSerializer,
)


# ─── CSRF ────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def csrf_token_view(request):
    """Returns a CSRF token so the SPA can bootstrap."""
    token = get_token(request)
    return Response({'csrfToken': token})


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
        counts = System.objects.aggregate(
            total=Count('id'),
            functional=Count(Case(When(status__in=['active', 'inactive'], then=1), output_field=IntegerField())),
            critical=Count(Case(When(status='non-functional', then=1), output_field=IntegerField())),
            active=Count(Case(When(status='active', then=1), output_field=IntegerField())),
        )
        total = counts['total']
        functional = counts['functional']
        critical = counts['critical']
        active = counts['active']

        def pct(n, d): return round((n / d) * 100, 1) if d else 0

        fault_counts = FaultReport.objects.aggregate(
            open=Count(Case(When(status__in=['unaddressed', 'in-progress'], then=1), output_field=IntegerField())),
            total=Count('fault_id'),
        )
        resource_counts = ResourceRequest.objects.aggregate(
            pending=Count(Case(When(status='Pending', then=1), output_field=IntegerField())),
            total=Count('resource_id'),
        )

        six_months_ago = timezone.now() - timezone.timedelta(days=180)
        fault_trend = (
            FaultReport.objects
            .filter(reported_at__gte=six_months_ago)
            .annotate(month=TruncMonth('reported_at'))
            .values('month')
            .annotate(count=Count('fault_id'))
            .order_by('month')
        )
        resource_trend = (
            ResourceRequest.objects
            .filter(requested_at__gte=six_months_ago)
            .annotate(month=TruncMonth('requested_at'))
            .values('month')
            .annotate(count=Count('resource_id'))
            .order_by('month')
        )

        fault_by_type = dict(
            FaultReport.objects.values('fault_type').annotate(n=Count('fault_id')).values_list('fault_type', 'n')
        )
        fault_by_status = dict(
            FaultReport.objects.values('status').annotate(n=Count('fault_id')).values_list('status', 'n')
        )

        recent_faults = FaultReport.objects.select_related('system_name', 'reported_by').order_by('-reported_at')[:5]
        recent_resources = ResourceRequest.objects.select_related('system_name', 'requested_by').order_by('-requested_at')[:5]

        activity = []
        for f in recent_faults:
            activity.append({
                'type': 'fault',
                'id': f.fault_id,
                'title': f'Fault on {f.system_name.host_name or "Unknown"}',
                'subtitle': f.fault_type,
                'status': f.status,
                'time': f.reported_at.isoformat(),
                'user': f.reported_by.username,
            })
        for r in recent_resources:
            activity.append({
                'type': 'resource',
                'id': r.resource_id,
                'title': f'Resource: {r.resource_name}',
                'subtitle': r.description[:60] if r.description else '',
                'status': r.status,
                'time': r.requested_at.isoformat(),
                'user': r.requested_by.username,
            })
        activity.sort(key=lambda x: x['time'], reverse=True)

        return Response({
            'systems': {
                'total': total, 'functional': functional,
                'critical': critical, 'active': active,
                'functional_pct': pct(functional, total),
                'critical_pct': pct(critical, total),
                'active_pct': pct(active, total),
                'utilization_pct': pct(active, functional),
            },
            'faults': fault_counts,
            'resources': resource_counts,
            'labs_total': Lab.objects.count(),
            'fault_trend': [{'month': x['month'].strftime('%b %Y'), 'count': x['count']} for x in fault_trend],
            'resource_trend': [{'month': x['month'].strftime('%b %Y'), 'count': x['count']} for x in resource_trend],
            'fault_by_type': fault_by_type,
            'fault_by_status': fault_by_status,
            'recent_activity': activity[:8],
        })


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
                parent_lab = None
                ancestor = item.parent
                while ancestor:
                    parent_lab = getattr(ancestor, 'lab', None)
                    if parent_lab:
                        break
                    ancestor = ancestor.parent
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
        item = get_object_or_404(LayoutItem, pk=pk)
        ancestors = item.get_ancestors()
        crumbs = [{'id': a.id, 'name': a.name, 'item_type': a.item_type} for a in ancestors]
        crumbs.append({'id': item.id, 'name': item.name, 'item_type': item.item_type})
        return Response(crumbs)


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
        labs = Lab.objects.select_related('layout_item', 'parent').prefetch_related('instructors', 'assistants')
        return Response(LabSerializer(labs, many=True).data)


class LabDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        lab = get_object_or_404(
            Lab.objects.select_related('layout_item', 'parent').prefetch_related('instructors', 'assistants'),
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
        qs = FaultReport.objects.select_related('system_name', 'system_name__lab', 'reported_by', 'resolved')
        q = request.GET.get('search', '').strip()
        s = request.GET.get('status', '').strip()
        t = request.GET.get('time', '').strip()
        sort = request.GET.get('sort', 'newest')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 15))

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
        total = qs.count()
        paginated = qs[(page - 1) * page_size: page * page_size]
        return Response({
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'results': FaultReportSerializer(paginated, many=True).data,
        })

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
            FaultReport.objects.select_related('system_name', 'system_name__lab', 'reported_by', 'resolved'),
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
        fault.save(update_fields=['status'])
        if new_status == 'resolved' and resolution_summary:
            Resolved.objects.update_or_create(
                fault_report=fault,
                defaults={'resolution_summary': resolution_summary, 'resolved_by': request.user},
            )
        fault.refresh_from_db()
        return Response(FaultReportSerializer(fault).data)


# ─── Resources ───────────────────────────────────────────────────────────────

class ResourceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ResourceRequest.objects.select_related('system_name', 'system_name__lab', 'requested_by', 'provided')
        q = request.GET.get('search', '').strip()
        s = request.GET.get('status', '').strip()
        t = request.GET.get('time', '').strip()
        sort = request.GET.get('sort', 'newest')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 15))

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
        total = qs.count()
        paginated = qs[(page - 1) * page_size: page * page_size]
        return Response({
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'results': ResourceRequestSerializer(paginated, many=True).data,
        })

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
        resource.save(update_fields=['status'])
        if new_status == 'Fulfilled' and provision_summary:
            Provided.objects.update_or_create(
                resource_request=resource,
                defaults={'provision_summary': provision_summary, 'provided_by': request.user},
            )
        resource.refresh_from_db()
        return Response(ResourceRequestSerializer(resource).data)


# ─── Reports ─────────────────────────────────────────────────────────────────

class ReportsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        fault_by_status = dict(
            FaultReport.objects.values('status').annotate(n=Count('fault_id')).values_list('status', 'n')
        )
        fault_by_type = dict(
            FaultReport.objects.values('fault_type').annotate(n=Count('fault_id')).values_list('fault_type', 'n')
        )
        resource_by_status = dict(
            ResourceRequest.objects.values('status').annotate(n=Count('resource_id')).values_list('status', 'n')
        )
        system_by_status = dict(
            System.objects.values('status').annotate(n=Count('id')).values_list('status', 'n')
        )
        six_months_ago = timezone.now() - timezone.timedelta(days=180)
        fault_monthly = list(
            FaultReport.objects.filter(reported_at__gte=six_months_ago)
            .annotate(month=TruncMonth('reported_at'))
            .values('month', 'fault_type')
            .annotate(count=Count('fault_id'))
            .order_by('month')
        )
        resource_monthly = list(
            ResourceRequest.objects.filter(requested_at__gte=six_months_ago)
            .annotate(month=TruncMonth('requested_at'))
            .values('month')
            .annotate(count=Count('resource_id'))
            .order_by('month')
        )
        return Response({
            'fault_by_status': fault_by_status,
            'fault_by_type': fault_by_type,
            'resource_by_status': resource_by_status,
            'system_by_status': system_by_status,
            'fault_monthly': [
                {'month': x['month'].strftime('%b %Y'), 'type': x['fault_type'], 'count': x['count']}
                for x in fault_monthly
            ],
            'resource_monthly': [
                {'month': x['month'].strftime('%b %Y'), 'count': x['count']}
                for x in resource_monthly
            ],
        })


# ─── Monitoring ──────────────────────────────────────────────────────────────

class MonitoringView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        latest_ids = (
            SystemInfo.objects.values('hostname')
            .annotate(max_id=Max('id')).values_list('max_id', flat=True)
        )
        infos = SystemInfo.objects.filter(id__in=latest_ids).order_by('hostname')
        return Response({'systems': SystemInfoSerializer(infos, many=True).data})


# ─── Users ───────────────────────────────────────────────────────────────────

class UserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.all()
        return Response(UserSerializer(users, many=True).data)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        ser = UserUpdateSerializer(user, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        ser.save()
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
