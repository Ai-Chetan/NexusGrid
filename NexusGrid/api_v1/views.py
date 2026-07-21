from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.db.models import Count, Case, When, IntegerField, Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.middleware.csrf import get_token

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination

from login_manager.models import User
from system_layout.models import LayoutItem, Lab, System, LabAssignment, PrivilegesConfig, SYSTEM_TYPES
from faults.models import FaultReport
from resources.models import ResourceRequest
from monitoring.models import SystemInfo, SystemCurrent
from api_v1.models import Notification
from .services.notifications import create_notifications, admin_user_ids, create_system_alert_if_needed

from .serializers import (
    UserSerializer, UserUpdateSerializer,
    NotificationSerializer, AdminNotificationCreateSerializer,
    LayoutItemSerializer, LayoutItemCreateSerializer, LayoutItemUpdateSerializer,
    SystemSerializer, LabSerializer, LabUpdateSerializer,
    FaultReportSerializer, FaultReportCreateSerializer, FaultStatusUpdateSerializer,
    ResourceRequestSerializer, ResourceCreateSerializer, ResourceStatusUpdateSerializer,
    SystemInfoSerializer,
    LabAssignmentSerializer, LabAssignmentCreateSerializer, PrivilegesConfigSerializer,
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


# ─── CSRF Token ──────────────────────────────────────────────────────────────

def get_csrf_token(request):
    csrf_token = get_token(request)

    return JsonResponse({"csrfToken": csrf_token})


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


_SIGNUP_OTP_KEY = 'signup_otp_data'
_FORGOT_OTP_KEY = 'forgot_otp_data'


def _send_otp_email(to_email: str, otp: str, subject: str, body_intro: str):
    from django.core.mail import send_mail
    message = (
        f"{body_intro}\n\n"
        f"    {otp}\n\n"
        f"This code expires in 5 minutes. Do not share it with anyone.\n\n"
        f"If you did not request this, please ignore this email."
    )
    send_mail(subject, message, None, [to_email], fail_silently=False)


class SignupRequestOTPView(APIView):
    """Step 1 of OTP-verified signup: validate fields and send OTP to email."""
    permission_classes = [AllowAny]

    def post(self, request):
        from datetime import datetime, timedelta
        from django.core.validators import validate_email as dj_validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError
        import random

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
                dj_validate_email(email)
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

        otp = f"{random.randint(100000, 999999):06d}"
        expiry = (datetime.now() + timedelta(minutes=5)).timestamp()

        request.session[_SIGNUP_OTP_KEY] = {
            'otp': otp,
            'username': username,
            'email': email,
            'password': password,
            'expires_at': expiry,
            'attempts': 0,
        }
        request.session.modified = True

        try:
            _send_otp_email(
                email, otp,
                subject='NexusGrid — Verify your email address',
                body_intro=f"Hi {username},\n\nYour NexusGrid email verification code is:",
            )
        except Exception:
            del request.session[_SIGNUP_OTP_KEY]
            return Response(
                {'detail': 'Failed to send OTP email. Please try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({'detail': 'OTP sent to your email address.'})


class SignupVerifyOTPView(APIView):
    """Step 2 of OTP-verified signup: verify OTP and create the account."""
    permission_classes = [AllowAny]

    def post(self, request):
        from datetime import datetime

        otp_data = request.session.get(_SIGNUP_OTP_KEY)
        if not otp_data:
            return Response({'detail': 'No pending verification. Please fill the form again.'}, status=400)

        if datetime.now().timestamp() > otp_data['expires_at']:
            del request.session[_SIGNUP_OTP_KEY]
            return Response({'detail': 'OTP has expired. Please request a new one.'}, status=400)

        attempts = otp_data.get('attempts', 0)
        if attempts >= 5:
            del request.session[_SIGNUP_OTP_KEY]
            return Response({'detail': 'Too many failed attempts. Please fill the form again.'}, status=400)

        submitted_otp = request.data.get('otp', '').strip()
        if submitted_otp != otp_data['otp']:
            otp_data['attempts'] = attempts + 1
            request.session[_SIGNUP_OTP_KEY] = otp_data
            request.session.modified = True
            remaining = 5 - otp_data['attempts']
            return Response({'detail': f'Incorrect OTP. {remaining} attempt(s) remaining.'}, status=400)

        # OTP correct — create account
        try:
            user = User.objects.create_user(
                username=otp_data['username'],
                email=otp_data['email'],
                password=otp_data['password'],
                role='No Roles',
            )
        except Exception:
            # Rare race condition if username/email was taken between steps
            del request.session[_SIGNUP_OTP_KEY]
            return Response({'detail': 'Account could not be created. The username or email may already be taken.'}, status=400)

        del request.session[_SIGNUP_OTP_KEY]
        login(request, user)
        return Response({'user': UserSerializer(user).data}, status=status.HTTP_201_CREATED)


class ForgotPasswordRequestView(APIView):
    """Step 1 of forgot-password: find user by email and send OTP."""
    permission_classes = [AllowAny]

    def post(self, request):
        from datetime import datetime, timedelta
        from django.core.validators import validate_email as dj_validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError
        import random

        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'email': 'Email is required.'}, status=400)
        try:
            dj_validate_email(email)
        except DjangoValidationError:
            return Response({'email': 'Enter a valid email address.'}, status=400)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Don't reveal whether email exists — generic message
            return Response({'detail': 'OTP sent to your email address if an account exists.'})

        otp = f"{random.randint(100000, 999999):06d}"
        expiry = (datetime.now() + timedelta(minutes=5)).timestamp()

        request.session[_FORGOT_OTP_KEY] = {
            'otp': otp,
            'user_id': user.pk,
            'expires_at': expiry,
            'attempts': 0,
        }
        request.session.modified = True

        try:
            _send_otp_email(
                user.email, otp,
                subject='NexusGrid — Password Reset OTP',
                body_intro=f"Hi {user.username},\n\nYour NexusGrid password reset code is:",
            )
        except Exception:
            del request.session[_FORGOT_OTP_KEY]
            return Response({'detail': 'Failed to send OTP email. Please try again.'}, status=503)

        return Response({'detail': 'OTP sent to your email address if an account exists.'})


class ForgotPasswordVerifyView(APIView):
    """Step 2 of forgot-password: verify OTP and set new password."""
    permission_classes = [AllowAny]

    def post(self, request):
        from datetime import datetime

        otp_data = request.session.get(_FORGOT_OTP_KEY)
        if not otp_data:
            return Response({'detail': 'No pending reset. Please request a new OTP.'}, status=400)

        if datetime.now().timestamp() > otp_data['expires_at']:
            del request.session[_FORGOT_OTP_KEY]
            return Response({'detail': 'OTP has expired. Please request a new one.'}, status=400)

        attempts = otp_data.get('attempts', 0)
        if attempts >= 5:
            del request.session[_FORGOT_OTP_KEY]
            return Response({'detail': 'Too many failed attempts. Please request a new OTP.'}, status=400)

        submitted_otp = request.data.get('otp', '').strip()
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        if submitted_otp != otp_data['otp']:
            otp_data['attempts'] = attempts + 1
            request.session[_FORGOT_OTP_KEY] = otp_data
            request.session.modified = True
            remaining = 5 - otp_data['attempts']
            return Response({'detail': f'Incorrect OTP. {remaining} attempt(s) remaining.'}, status=400)

        if not new_password or len(new_password) < 8:
            return Response({'new_password': 'Password must be at least 8 characters.'}, status=400)
        if new_password != confirm_password:
            return Response({'confirm_password': 'Passwords do not match.'}, status=400)

        try:
            user = User.objects.get(pk=otp_data['user_id'])
        except User.DoesNotExist:
            del request.session[_FORGOT_OTP_KEY]
            return Response({'detail': 'User not found.'}, status=400)

        user.set_password(new_password)
        user.save()
        del request.session[_FORGOT_OTP_KEY]
        return Response({'detail': 'Password reset successfully. You can now log in.'})


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
        def _to_int(value):
            if value in (None, ''):
                return None
            try:
                return int(value)
            except (TypeError, ValueError):
                return None

        return Response(get_dashboard_metrics(
            user=request.user,
            building_id=_to_int(request.query_params.get('building_id')),
            floor_id=_to_int(request.query_params.get('floor_id')),
            room_id=_to_int(request.query_params.get('room_id')),
            start_date=request.query_params.get('start_date') or None,
            end_date=request.query_params.get('end_date') or None,
        ))


# ─── Layout ──────────────────────────────────────────────────────────────────

# ─── Layout helpers ─────────────────────────────────────────────────────────────

def _get_restricted_item_ids(user):
    """
    For Lab Incharge / Lab Assistant users: compute the set of LayoutItem IDs
    that the user is allowed to see.

    Includes:
    - The room LayoutItems for the user's currently active assigned labs.
    - All children of those rooms (devices).
    - All ancestor items (floors, buildings) needed for navigation.
    """
    assigned_room_ids = list(
        LabAssignment.get_active_labs_for_user(user)
        .values_list('lab__layout_item_id', flat=True)
    )
    if not assigned_room_ids:
        return frozenset()

    allowed: set = set(assigned_room_ids)

    # Include all direct children (devices inside the assigned rooms)
    children = LayoutItem.objects.filter(
        parent_id__in=assigned_room_ids
    ).values_list('id', flat=True)
    allowed.update(children)

    # Walk up the hierarchy (room → floor → building → …)
    current = set(assigned_room_ids)
    for _ in range(4):  # max tree depth guard
        parent_ids = set(
            LayoutItem.objects
            .filter(id__in=current, parent__isnull=False)
            .values_list('parent_id', flat=True)
        )
        new_parents = parent_ids - allowed
        if not new_parents:
            break
        allowed.update(new_parents)
        current = new_parents

    return frozenset(allowed)


def _assigned_lab_ids(user):
    """Active assigned lab IDs for a Lab Incharge / Lab Assistant."""
    today = timezone.now().date()
    return list(
        LabAssignment.objects
        .filter(user=user)
        .filter(Q(start_date__isnull=True) | Q(start_date__lte=today))
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        .values_list('lab_id', flat=True)
        .distinct()
    )


def _notify_admins_layout_change(user, action, item):
    """Lab Assistant layout edits are applied immediately but flagged to admins for validation."""
    if user.role != 'Lab Assistant':
        return
    create_notifications(
        recipient_ids=admin_user_ids(),
        message=f"Layout {action} by {user.username}: {item.item_type} '{item.name}' — pending admin validation.",
        related_to='layout_change',
        related_id=item.id,
        target_url='/app/layout',
        created_by_id=user.id,
    )


def _latest_monitored_hostname_set():
    """Return all hostnames that have monitoring data in the current-state table."""
    return set(
        SystemCurrent.objects
        .values_list('hostname_key', flat=True)
    )


def _layout_alert_context():
    active_fault_layout_ids = set(
        FaultReport.objects.filter(status__in=['unaddressed', 'in-progress', 'scheduled'])
        .values_list('system_name__layout_item_id', flat=True)
    )
    pending_resource_layout_ids = set(
        ResourceRequest.objects.filter(status='Pending')
        .values_list('system_name__layout_item_id', flat=True)
    )
    return {
        'active_fault_layout_ids': active_fault_layout_ids,
        'pending_resource_layout_ids': pending_resource_layout_ids,
    }


def _layout_serializer_context():
    return {
        'monitored_hostnames': _latest_monitored_hostname_set(),
        **_layout_alert_context(),
    }


class LayoutItemsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        parent_id = request.GET.get('parent_id')
        parent_id = int(parent_id) if parent_id and parent_id.isdigit() else None
        qs = LayoutItem.objects.select_related('system', 'lab')

        user = request.user
        if user.role in ('Lab Incharge', 'Lab Assistant'):
            # For restricted users at root level, show their assigned lab rooms
            # directly instead of buildings — no navigation from building needed.
            assigned_room_ids = list(
                LabAssignment.get_active_labs_for_user(user)
                .values_list('lab__layout_item_id', flat=True)
            )
            if not assigned_room_ids:
                return Response([])

            if parent_id is None:
                # Root level: show assigned lab rooms directly
                items = qs.filter(id__in=assigned_room_ids)
            else:
                # Inside a lab: show children (devices) of that lab
                allowed_ids = _get_restricted_item_ids(user)
                items = qs.filter(parent_id=parent_id, id__in=allowed_ids)
        else:
            items = qs.filter(parent_id=parent_id) if parent_id else qs.filter(parent__isnull=True)

        return Response(LayoutItemSerializer(items, many=True, context=_layout_serializer_context()).data)

    def post(self, request):
        # Admin: full edit rights. Lab Assistant: edits allowed but flagged for admin validation.
        # Lab Incharge and others: view-only.
        if request.user.role not in ('Administrator', 'Lab Assistant'):
            return Response({'detail': 'You do not have permission to edit the layout.'}, status=403)
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
            elif item.item_type in SYSTEM_TYPES:
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
        _notify_admins_layout_change(request.user, 'change (created)', item)
        return Response(LayoutItemSerializer(item).data, status=201)


class LayoutItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        item = get_object_or_404(LayoutItem.objects.select_related('system', 'lab'), pk=pk)
        return Response(LayoutItemSerializer(item, context=_layout_serializer_context()).data)

    def patch(self, request, pk):
        from django.db import transaction
        if request.user.role not in ('Administrator', 'Lab Assistant'):
            return Response({'detail': 'You do not have permission to edit the layout.'}, status=403)
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
            if item.item_type in SYSTEM_TYPES:
                system = getattr(item, 'system', None)
                if system and name_changed:
                    system.host_name = item.name
                    system.updated_at = timezone.now()
                    system.updated_by = request.user
                    system.save(update_fields=['host_name', 'updated_at', 'updated_by_id'])
        _notify_admins_layout_change(request.user, 'change (updated)', item)
        return Response(LayoutItemSerializer(item).data)

    def delete(self, request, pk):
        if request.user.role not in ('Administrator', 'Lab Assistant'):
            return Response({'detail': 'You do not have permission to edit the layout.'}, status=403)
        item = get_object_or_404(LayoutItem, pk=pk)
        _notify_admins_layout_change(request.user, 'change (deleted)', item)
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
        if request.user.role not in ('Administrator', 'Lab Assistant'):
            return Response({'detail': 'You do not have permission to update system status.'}, status=403)
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
            .select_related('layout_item', 'layout_item__parent', 'layout_item__parent__parent')
            .prefetch_related('instructors', 'assistants', 'assignments__user')
            .annotate(systems_count=Count('system', distinct=True))
        )
        return Response(LabSerializer(labs, many=True).data)


class LabDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        lab = get_object_or_404(
            Lab.objects
            .select_related('layout_item', 'layout_item__parent', 'layout_item__parent__parent')
            .prefetch_related('instructors', 'assistants', 'assignments__user')
            .annotate(systems_count=Count('system', distinct=True)),
            pk=pk,
        )
        return Response(LabSerializer(lab).data)

    def patch(self, request, pk):
        if request.user.role not in ('Administrator', 'Lab Assistant'):
            return Response({'detail': 'You do not have permission to edit labs.'}, status=403)
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
        # Admin: all faults. Lab Assistant: faults in their assigned labs (they handle them).
        # Everyone else (incl. Lab Incharge): only their own reports.
        if request.user.role == 'Lab Assistant':
            qs = qs.filter(
                Q(system_name__lab_id__in=_assigned_lab_ids(request.user)) |
                Q(reported_by=request.user)
            )
        elif request.user.role != 'Administrator':
            qs = qs.filter(reported_by=request.user)
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
        # Admins cannot report faults — only incharge/assistant/students can.
        if request.user.role == 'Administrator':
            return Response({'detail': 'Administrators cannot report faults.'}, status=403)
        ser = FaultReportCreateSerializer(data=request.data, context={'request': request})
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        fault = ser.save()

        recipients = admin_user_ids()
        if request.user.id not in recipients:
            recipients.append(request.user.id)
        create_notifications(
            recipient_ids=recipients,
            message=(
                f"New fault report on {fault.system_name.host_name}: "
                f"{fault.fault_type} (risk {fault.risk_factor})."
            ),
            related_to='fault_report',
            related_id=fault.fault_id,
            target_url='/app/faults',
            created_by_id=request.user.id,
        )

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
        user = request.user

        # Incharge can only edit their own fault's description/type (not status).
        if user.role == 'Lab Incharge':
            if fault.reported_by_id != user.id:
                return Response({'detail': 'You can only edit your own fault reports.'}, status=403)
            update_fields = []
            if 'description' in request.data:
                fault.description = request.data['description']
                update_fields.append('description')
            if 'fault_type' in request.data:
                fault.fault_type = request.data['fault_type']
                update_fields.append('fault_type')
            if update_fields:
                fault.save(update_fields=update_fields)
            fault.refresh_from_db()
            return Response(FaultReportSerializer(fault).data)

        # Only admins and assistants (fault handlers) can update fault status.
        if user.role not in ('Administrator', 'Lab Assistant'):
            return Response({'detail': 'You do not have permission to update fault status.'}, status=403)

        old_status = fault.status
        ser = FaultStatusUpdateSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        new_status = ser.validated_data['status']
        resolution_summary = ser.validated_data.get('resolution_summary', '')
        fault.status = new_status
        update_fields = ['status']
        # Assistant sets risk_factor when updating status
        if 'risk_factor' in request.data:
            try:
                rf = int(request.data['risk_factor'])
                if 1 <= rf <= 5:
                    fault.risk_factor = rf
                    update_fields.append('risk_factor')
            except (TypeError, ValueError):
                pass
        if new_status == 'resolved' and resolution_summary:
            fault.resolution_summary = resolution_summary
            fault.resolved_by = user
            fault.resolved_at = timezone.now()
            update_fields += ['resolution_summary', 'resolved_by', 'resolved_at']
        fault.save(update_fields=update_fields)
        fault.refresh_from_db()

        if old_status != new_status:
            recipients = [fault.reported_by_id]
            for admin_id in admin_user_ids():
                if admin_id not in recipients:
                    recipients.append(admin_id)
            create_notifications(
                recipient_ids=recipients,
                message=(
                    f"Fault status updated on {fault.system_name.host_name}: "
                    f"{old_status} -> {new_status}."
                ),
                related_to='fault_status_update',
                related_id=fault.fault_id,
                target_url='/app/faults',
                created_by_id=user.id,
            )

        return Response(FaultReportSerializer(fault).data)

    def delete(self, request, pk):
        """Incharge can delete their own fault reports. Admin can delete any."""
        fault = get_object_or_404(FaultReport, pk=pk)
        user = request.user
        if user.role == 'Administrator':
            pass
        elif user.role == 'Lab Incharge' and fault.reported_by_id == user.id:
            pass
        else:
            return Response({'detail': 'You can only delete your own fault reports.'}, status=403)
        fault.delete()
        return Response(status=204)


# ─── Resources ───────────────────────────────────────────────────────────────

class ResourceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ResourceRequest.objects.select_related('system_name', 'system_name__lab', 'requested_by', 'provided_by')
        # Admin: all requests. Lab Assistant: requests in their assigned labs (they fulfil/forward them).
        # Everyone else (incl. Lab Incharge): only their own requests.
        if request.user.role == 'Lab Assistant':
            qs = qs.filter(
                Q(system_name__lab_id__in=_assigned_lab_ids(request.user)) |
                Q(requested_by=request.user)
            )
        elif request.user.role != 'Administrator':
            qs = qs.filter(requested_by=request.user)
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
        # Admins cannot create resource requests.
        if request.user.role == 'Administrator':
            return Response({'detail': 'Administrators cannot create resource requests.'}, status=403)
        ser = ResourceCreateSerializer(data=request.data, context={'request': request})
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        res = ser.save()

        recipients = admin_user_ids()
        if request.user.id not in recipients:
            recipients.append(request.user.id)
        create_notifications(
            recipient_ids=recipients,
            message=f"New resource request for {res.resource_name} on {res.system_name.host_name}.",
            related_to='resource_request',
            related_id=res.resource_id,
            target_url='/app/resources',
            created_by_id=request.user.id,
        )

        return Response(ResourceRequestSerializer(res).data, status=201)


class ResourceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        resource = get_object_or_404(ResourceRequest, pk=pk)
        user = request.user

        # Requester (incharge) can only edit their own request's description/resource_name (not status).
        if user.role == 'Lab Incharge':
            if resource.requested_by_id != user.id:
                return Response({'detail': 'You can only edit your own resource requests.'}, status=403)
            update_fields = []
            if 'description' in request.data:
                resource.description = request.data['description']
                update_fields.append('description')
            if 'resource_name' in request.data:
                resource.resource_name = request.data['resource_name']
                update_fields.append('resource_name')
            if 'quantity' in request.data:
                resource.quantity = request.data['quantity']
                update_fields.append('quantity')
            if update_fields:
                resource.save(update_fields=update_fields)
            resource.refresh_from_db()
            return Response(ResourceRequestSerializer(resource).data)

        # Admin takes final decisions; assistants may fulfil/modify (admins are notified to validate).
        if user.role not in ('Administrator', 'Lab Assistant'):
            return Response({'detail': 'You do not have permission to update resource requests.'}, status=403)

        old_status = resource.status
        ser = ResourceStatusUpdateSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        new_status = ser.validated_data['status']
        provision_summary = ser.validated_data.get('provision_summary', '')
        resource.status = new_status
        update_fields = ['status']
        if 'cost' in ser.validated_data:
            resource.cost = ser.validated_data['cost']
            update_fields.append('cost')
        if 'quantity' in ser.validated_data:
            resource.quantity = ser.validated_data['quantity']
            update_fields.append('quantity')
        if new_status == 'Fulfilled' and provision_summary:
            resource.provision_summary = provision_summary
            resource.provided_by = user
            resource.provided_at = timezone.now()
            update_fields += ['provision_summary', 'provided_by', 'provided_at']
        resource.save(update_fields=update_fields)

        resource.refresh_from_db()

        if old_status != new_status:
            recipients = [resource.requested_by_id]
            for admin_id in admin_user_ids():
                if admin_id not in recipients:
                    recipients.append(admin_id)
            create_notifications(
                recipient_ids=recipients,
                message=(
                    f"Resource request status updated for {resource.resource_name}: "
                    f"{old_status} -> {new_status}."
                ),
                related_to='resource_status_update',
                related_id=resource.resource_id,
                target_url='/app/resources',
                created_by_id=user.id,
            )

        return Response(ResourceRequestSerializer(resource).data)

    def delete(self, request, pk):
        """Incharge can delete their own resource requests. Admin can delete any."""
        resource = get_object_or_404(ResourceRequest, pk=pk)
        user = request.user
        if user.role == 'Administrator':
            pass
        elif user.role == 'Lab Incharge' and resource.requested_by_id == user.id:
            pass
        else:
            return Response({'detail': 'You can only delete your own resource requests.'}, status=403)
        resource.delete()
        return Response(status=204)


# ─── Reports ─────────────────────────────────────────────────────────────────

def _resolve_report_lab_scope(user, query_params):
    """Resolve report lab scope for current user and optional filter params."""
    today = timezone.now().date()

    if user.role in ('Lab Incharge', 'Lab Assistant'):
        assigned_lab_ids = list(
            LabAssignment.objects
            .filter(user=user)
            .filter(Q(start_date__isnull=True) | Q(start_date__lte=today))
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
            .values_list('lab_id', flat=True)
            .distinct()
        )

        lab_id_param = query_params.get('lab_id', '').strip()
        if lab_id_param.isdigit():
            requested = int(lab_id_param)
            if requested in assigned_lab_ids:
                return [requested]

        return assigned_lab_ids or [-1]

    lab_id = query_params.get('lab_id', '').strip()
    room_id = query_params.get('room_id', '').strip()
    floor_id = query_params.get('floor_id', '').strip()
    building_id = query_params.get('building_id', '').strip()

    if lab_id.isdigit():
        return [int(lab_id)]

    if room_id.isdigit():
        return list(
            Lab.objects
            .filter(layout_item_id=int(room_id))
            .values_list('id', flat=True)
        )

    if floor_id.isdigit():
        return list(
            Lab.objects
            .filter(layout_item__parent_id=int(floor_id))
            .values_list('id', flat=True)
        )

    if building_id.isdigit():
        return list(
            Lab.objects
            .filter(layout_item__parent__parent_id=int(building_id))
            .values_list('id', flat=True)
        )

    return None


class ReportsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .services.metrics import get_report_metrics
        if request.user.role == 'Lab Incharge':
            return Response({'detail': 'Reports are not available for Lab Incharge.'}, status=403)
        lab_ids = _resolve_report_lab_scope(request.user, request.GET)
        return Response(get_report_metrics(lab_ids=lab_ids))


class ReportsDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'Lab Incharge':
            return Response({'detail': 'Reports are not available for Lab Incharge.'}, status=403)
        lab_ids = _resolve_report_lab_scope(request.user, request.GET)

        if lab_ids is None:
            lab_filter = Q()
        else:
            lab_filter = Q(lab_id__in=lab_ids)

        systems_qs = (
            System.objects
            .filter(lab_filter)
            .select_related('lab', 'lab__layout_item', 'lab__layout_item__parent', 'lab__layout_item__parent__parent')
            .order_by('lab__lab_name', 'host_name', 'id')
        )
        faults_qs = (
            FaultReport.objects
            .filter(Q(system_name__lab_id__in=lab_ids) if lab_ids is not None else Q())
            .select_related(
                'system_name',
                'system_name__lab',
                'system_name__lab__layout_item',
                'system_name__lab__layout_item__parent',
                'system_name__lab__layout_item__parent__parent',
                'reported_by',
                'resolved_by',
            )
            .order_by('-reported_at')
        )
        resources_qs = (
            ResourceRequest.objects
            .filter(Q(system_name__lab_id__in=lab_ids) if lab_ids is not None else Q())
            .select_related(
                'system_name',
                'system_name__lab',
                'system_name__lab__layout_item',
                'system_name__lab__layout_item__parent',
                'system_name__lab__layout_item__parent__parent',
                'requested_by',
                'provided_by',
            )
            .order_by('-requested_at')
        )

        def _location(lab):
            room = getattr(lab, 'layout_item', None)
            floor = getattr(room, 'parent', None) if room else None
            building = getattr(floor, 'parent', None) if floor else None
            return (
                room.name if room else '',
                floor.name if floor else '',
                building.name if building else '',
            )

        systems = []
        for s in systems_qs:
            room_name, floor_name, building_name = _location(s.lab)
            systems.append({
                'id': s.id,
                'host_name': s.host_name or (s.layout_item.name if s.layout_item else f'System-{s.id}'),
                'status': s.status,
                'lab_name': s.lab.lab_name if s.lab else '',
                'room_name': room_name,
                'floor_name': floor_name,
                'building_name': building_name,
                'updated_at': s.updated_at.isoformat() if s.updated_at else '',
            })

        faults = []
        for f in faults_qs:
            lab = f.system_name.lab
            room_name, floor_name, building_name = _location(lab)
            faults.append({
                'fault_id': f.fault_id,
                'reported_at': f.reported_at.isoformat(),
                'status': f.status,
                'fault_type': f.fault_type,
                'risk_factor': f.risk_factor,
                'system_name': f.system_name.host_name or '',
                'lab_name': lab.lab_name if lab else '',
                'room_name': room_name,
                'floor_name': floor_name,
                'building_name': building_name,
                'reported_by': f.reported_by.username,
                'description': f.description,
                'resolution_summary': f.resolution_summary or '',
                'resolved_at': f.resolved_at.isoformat() if f.resolved_at else '',
                'resolved_by': f.resolved_by.username if f.resolved_by else '',
            })

        resources = []
        for r in resources_qs:
            lab = r.system_name.lab
            room_name, floor_name, building_name = _location(lab)
            resources.append({
                'resource_id': r.resource_id,
                'requested_at': r.requested_at.isoformat(),
                'status': r.status,
                'resource_name': r.resource_name,
                'system_name': r.system_name.host_name or '',
                'lab_name': lab.lab_name if lab else '',
                'room_name': room_name,
                'floor_name': floor_name,
                'building_name': building_name,
                'requested_by': r.requested_by.username,
                'description': r.description,
                'provision_summary': r.provision_summary or '',
                'provided_at': r.provided_at.isoformat() if r.provided_at else '',
                'provided_by': r.provided_by.username if r.provided_by else '',
            })

        return Response({
            'generated_at': timezone.now().isoformat(),
            'systems': systems,
            'faults': faults,
            'resources': resources,
        })


# ─── Admin oversight & budgeting ─────────────────────────────────────────────

def _admin_only(request):
    """Return a 403 Response if the user is not an Administrator, else None."""
    if request.user.role != 'Administrator':
        return Response({'detail': 'Admin only.'}, status=403)
    return None


def _parse_range(query_params):
    """Return (start_date, end_date) date objects from ?start=&end= (YYYY-MM-DD)."""
    from datetime import datetime

    def _d(v):
        v = (v or '').strip()
        try:
            return datetime.strptime(v, '%Y-%m-%d').date()
        except ValueError:
            return None

    return _d(query_params.get('start')), _d(query_params.get('end'))


class AdminStaffActivityView(APIView):
    """Feature B — per-user activity summary for Lab Incharge / Lab Assistant.

    Counts faults reported/resolved, resources requested, and systems touched,
    optionally scoped to a ?start=&end= date range.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _admin_only(request)
        if denied:
            return denied

        start, end = _parse_range(request.GET)
        staff = User.objects.filter(role__in=['Lab Incharge', 'Lab Assistant']).order_by('username')

        fault_reported = FaultReport.objects.all()
        fault_resolved = FaultReport.objects.filter(status='resolved')
        resources = ResourceRequest.objects.all()
        if start:
            fault_reported = fault_reported.filter(reported_at__date__gte=start)
            fault_resolved = fault_resolved.filter(resolved_at__date__gte=start)
            resources = resources.filter(requested_at__date__gte=start)
        if end:
            fault_reported = fault_reported.filter(reported_at__date__lte=end)
            fault_resolved = fault_resolved.filter(resolved_at__date__lte=end)
            resources = resources.filter(requested_at__date__lte=end)

        reported_by = dict(
            fault_reported.values('reported_by').annotate(n=Count('fault_id')).values_list('reported_by', 'n')
        )
        resolved_by = dict(
            fault_resolved.values('resolved_by').annotate(n=Count('fault_id')).values_list('resolved_by', 'n')
        )
        requested_by = dict(
            resources.values('requested_by').annotate(n=Count('resource_id')).values_list('requested_by', 'n')
        )

        rows = [
            {
                'user_id': u.id,
                'username': u.username,
                'role': u.role,
                'faults_reported': reported_by.get(u.id, 0),
                'faults_resolved': resolved_by.get(u.id, 0),
                'resources_requested': requested_by.get(u.id, 0),
            }
            for u in staff
        ]
        return Response({
            'start': start.isoformat() if start else None,
            'end': end.isoformat() if end else None,
            'staff': rows,
        })


class AdminTaskSheetView(APIView):
    """Feature D — task sheet for a single assistant over a custom date range.

    Requires ?user_id=&start=&end=. Returns every fault and resource the user
    touched in the window, plus totals.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = request.GET.get('user_id', '').strip()
        # Admins: any user. Lab Assistants: their own task sheet only.
        if request.user.role != 'Administrator':
            if request.user.role != 'Lab Assistant' or user_id != str(request.user.id):
                return Response({'detail': 'Admin only.'}, status=403)
        if not user_id.isdigit():
            return Response({'detail': 'user_id is required.'}, status=400)
        start, end = _parse_range(request.GET)
        if not (start and end):
            return Response({'detail': 'start and end (YYYY-MM-DD) are required.'}, status=400)

        target = get_object_or_404(User, pk=int(user_id))

        faults = (
            FaultReport.objects
            .filter(reported_by=target, reported_at__date__gte=start, reported_at__date__lte=end)
            .select_related('system_name', 'system_name__lab')
            .order_by('reported_at')
        )
        resources = (
            ResourceRequest.objects
            .filter(requested_by=target, requested_at__date__gte=start, requested_at__date__lte=end)
            .select_related('system_name', 'system_name__lab')
            .order_by('requested_at')
        )

        fault_rows = [{
            'fault_id': f.fault_id,
            'reported_at': f.reported_at.isoformat(),
            'system_name': f.system_name.host_name or '',
            'lab_name': f.system_name.lab.lab_name if f.system_name.lab else '',
            'fault_type': f.fault_type,
            'risk_factor': f.risk_factor,
            'status': f.status,
            'description': f.description,
        } for f in faults]

        resource_rows = [{
            'resource_id': r.resource_id,
            'requested_at': r.requested_at.isoformat(),
            'system_name': r.system_name.host_name or '',
            'lab_name': r.system_name.lab.lab_name if r.system_name.lab else '',
            'resource_name': r.resource_name,
            'quantity': r.quantity,
            'cost': float(r.cost) if r.cost is not None else None,
            'status': r.status,
            'description': r.description,
        } for r in resources]


        return Response({
            'user': {'id': target.id, 'username': target.username, 'role': target.role},
            'start': start.isoformat(),
            'end': end.isoformat(),
            'generated_at': timezone.now().isoformat(),
            'faults': fault_rows,
            'resources': resource_rows,
            'totals': {
                'faults': len(fault_rows),
                'resources': len(resource_rows),
            },
        })


class AdminBudgetSummaryView(APIView):
    """Feature E — monthly resource-demand + budget summary for budgeting.

    Groups fulfilled/all resource requests by requested_at year-month, counting
    distinct requesting assistants and summing cost*quantity.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum, F, DecimalField
        from django.db.models.functions import TruncMonth

        denied = _admin_only(request)
        if denied:
            return denied

        start, end = _parse_range(request.GET)
        qs = ResourceRequest.objects.all()
        if start:
            qs = qs.filter(requested_at__date__gte=start)
        if end:
            qs = qs.filter(requested_at__date__lte=end)

        rows = (
            qs
            .annotate(month=TruncMonth('requested_at'))
            .values('month')
            .annotate(
                request_count=Count('resource_id'),
                distinct_requesters=Count('requested_by', distinct=True),
                total_cost=Sum(
                    F('cost') * F('quantity'),
                    output_field=DecimalField(max_digits=16, decimal_places=2),
                ),
            )
            .order_by('month')
        )

        months = [{
            'month': r['month'].strftime('%b %Y') if r['month'] else '',
            'request_count': r['request_count'],
            'distinct_requesters': r['distinct_requesters'],
            'total_cost': float(r['total_cost']) if r['total_cost'] is not None else 0.0,
        } for r in rows]

        return Response({
            'start': start.isoformat() if start else None,
            'end': end.isoformat() if end else None,
            'generated_at': timezone.now().isoformat(),
            'months': months,
            'grand_total_cost': round(sum(m['total_cost'] for m in months), 2),
        })


# ─── Monitoring ──────────────────────────────────────────────────────────────

MONITORING_CACHE_KEY = 'monitoring_latest_v1'

MONITORING_CACHE_TTL = 30  # seconds — matches the frontend 30s polling interval


class MonitoringView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        item_id = request.GET.get('item_id', '').strip()
        if item_id.isdigit():
            item = get_object_or_404(
                LayoutItem.objects.select_related('system'),
                pk=int(item_id),
            )
            system = getattr(item, 'system', None)
            hostname = (system.host_name if system else item.name) or ''
            hostname = hostname.strip()
            if not hostname:
                return Response({'detail': 'No hostname found for this item.'}, status=404)

            key = hostname.lower()
            current = SystemCurrent.objects.select_related('latest_info').filter(hostname_key=key).first()
            info = current.latest_info if current and current.latest_info_id else None
            if info is None:
                info = (
                    SystemInfo.objects
                    .filter(hostname__iexact=hostname)
                    .order_by('-timestamp', '-id')
                    .first()
                )
            if not info:
                return Response({'detail': 'No monitoring data for this host.'}, status=404)
            create_system_alert_if_needed(
                hostname=info.hostname,
                memory_usage_percent=info.memory_usage_percent,
            )
            return Response(SystemInfoSerializer(info).data)

        # Fleet-wide monitoring list is restricted to admins and assistants.
        # (Per-item monitoring above stays open so the QR / system-detail flow works for everyone.)
        if request.user.role not in ('Administrator', 'Lab Assistant'):
            return Response({'detail': 'Monitoring is not available for your role.'}, status=403)

        from django.core.cache import cache
        is_assistant = request.user.role == 'Lab Assistant'
        cache_key = MONITORING_CACHE_KEY if not is_assistant else None
        if cache_key:
            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached)

        systems = [
            row.latest_info
            for row in SystemCurrent.objects.select_related('latest_info').order_by('hostname')
            if row.latest_info_id
        ]

        # Lab Assistants only see devices in their assigned labs.
        if is_assistant:
            assigned_hostnames = {
                (h or '').strip().lower()
                for h in System.objects
                .filter(lab_id__in=_assigned_lab_ids(request.user))
                .values_list('host_name', flat=True)
            }
            systems = [s for s in systems if (s.hostname or '').strip().lower() in assigned_hostnames]

        for info in systems:
            create_system_alert_if_needed(
                hostname=info.hostname,
                memory_usage_percent=info.memory_usage_percent,
            )
        data = {'systems': SystemInfoSerializer(systems, many=True).data}
        if cache_key:
            cache.set(cache_key, data, MONITORING_CACHE_TTL)
        return Response(data)


# ─── Notifications ───────────────────────────────────────────────────────────

class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.select_related('created_by').filter(recipient=request.user)
        unread_only = request.GET.get('unread', '').strip().lower() in {'1', 'true', 'yes'}
        if unread_only:
            qs = qs.filter(is_read=False)

        paginator = StandardPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(NotificationSerializer(page, many=True).data)

    def post(self, request):
        if request.user.role != 'Administrator':
            return Response({'detail': 'Admin only.'}, status=403)

        ser = AdminNotificationCreateSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)

        payload = ser.validated_data
        if payload.get('send_to_all'):
            recipient_ids = list(User.objects.values_list('id', flat=True))
        else:
            recipient_ids = payload.get('recipient_ids', [])

        create_notifications(
            recipient_ids=recipient_ids,
            message=payload['message'],
            related_to='admin_message',
            related_id=None,
            target_url=payload.get('target_url', '/app/dashboard') or '/app/dashboard',
            created_by_id=request.user.id,
        )
        return Response({'detail': 'Notification(s) created.'}, status=201)

    def delete(self, request):
        scope = (request.GET.get('scope') or 'all').strip().lower()
        qs = Notification.objects.filter(recipient=request.user)
        if scope == 'unread':
            qs = qs.filter(is_read=False)
        elif scope == 'read':
            qs = qs.filter(is_read=True)
        deleted, _ = qs.delete()
        return Response({'detail': 'Notifications cleared.', 'deleted': deleted, 'scope': scope})


class NotificationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
        notif.is_read = bool(request.data.get('is_read', True))
        notif.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notif).data)


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'Unread notifications cleared.', 'updated': updated})


class MonitoringHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        item_id = request.GET.get('item_id', '').strip()
        if not item_id.isdigit():
            return Response({'detail': 'item_id is required.'}, status=400)

        limit_raw = request.GET.get('limit', '72').strip()
        try:
            limit = int(limit_raw)
        except ValueError:
            limit = 72
        limit = max(10, min(limit, 500))

        item = get_object_or_404(
            LayoutItem.objects.select_related('system'),
            pk=int(item_id),
        )
        system = getattr(item, 'system', None)
        hostname = (system.host_name if system else item.name) or ''
        hostname = hostname.strip()
        if not hostname:
            return Response({'detail': 'No hostname found for this item.'}, status=404)

        history_qs = (
            SystemInfo.objects
            .filter(hostname__iexact=hostname)
            .order_by('-timestamp', '-id')[:limit]
        )
        history = list(reversed(list(history_qs)))

        return Response({
            'item_id': item.id,
            'hostname': hostname,
            'history': SystemInfoSerializer(history, many=True).data,
        })


# ─── Users ───────────────────────────────────────────────────────────────────

USER_LIST_CACHE_KEY = 'user_list_v1'
USER_LIST_CACHE_TTL = 60 * 5  # 5 minutes


class UserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.core.cache import cache
        role = request.GET.get('role', '').strip()
        # Skip cache when filtering by role
        if role:
            users = User.objects.filter(role=role)
            return Response(UserSerializer(users, many=True).data)
        cached = cache.get(USER_LIST_CACHE_KEY)
        if cached is not None:
            return Response(cached)
        users = User.objects.all()
        data = UserSerializer(users, many=True).data
        cache.set(USER_LIST_CACHE_KEY, data, USER_LIST_CACHE_TTL)
        return Response(data)


class AdminCreateUserView(APIView):
    """Admin creates a pre-configured account (role set) and shares credentials manually."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError

        if request.user.role != 'Administrator':
            return Response({'detail': 'Admin only.'}, status=403)

        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        role = request.data.get('role', 'No Roles')

        valid_roles = ('Administrator', 'Lab Incharge', 'Lab Assistant', 'Students', 'No Roles')
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
        if role not in valid_roles:
            errors['role'] = 'Invalid role.'
        if errors:
            return Response(errors, status=400)

        user = User.objects.create_user(username=username, email=email, password=password, role=role)

        from django.core.cache import cache
        cache.delete(USER_LIST_CACHE_KEY)
        return Response({'user': UserSerializer(user).data}, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if request.user.role != 'Administrator':
            return Response({'detail': 'Admin only.'}, status=403)
        user = get_object_or_404(User, pk=pk)
        old_role = user.role
        ser = UserUpdateSerializer(user, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        ser.save()

        # If role changed away from an assignable role, revoke all lab assignments
        new_role = user.role
        revoked_count = 0
        if old_role != new_role and old_role in ('Lab Incharge', 'Lab Assistant'):
            revoked_count = LabAssignment.objects.filter(user=user).count()
            LabAssignment.objects.filter(user=user).delete()

        # Bust the cached user list
        from django.core.cache import cache
        cache.delete(USER_LIST_CACHE_KEY)
        data = UserSerializer(user).data
        data['revoked_assignments'] = revoked_count
        return Response(data)

    def delete(self, request, pk):
        """Admin deletes a user account."""
        if request.user.role != 'Administrator':
            return Response({'detail': 'Admin only.'}, status=403)
        user = get_object_or_404(User, pk=pk)
        if user.pk == request.user.pk:
            return Response({'detail': 'You cannot delete your own account.'}, status=400)
        username = user.username
        # Revoke all lab assignments
        LabAssignment.objects.filter(user=user).delete()
        user.delete()
        from django.core.cache import cache
        cache.delete(USER_LIST_CACHE_KEY)
        return Response({'detail': f'User "{username}" deleted.'}, status=status.HTTP_204_NO_CONTENT)


class SystemsListView(APIView):
    """Return systems for dropdowns.

    Administrators receive all systems.
    Lab Incharge / Lab Assistant receive only the systems belonging to labs
    they are currently actively assigned to, so the fault-report and
    resource-request modals only offer relevant options.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = System.objects.select_related('lab', 'layout_item')

        if user.role in ('Lab Incharge', 'Lab Assistant'):
            today = timezone.now().date()
            assigned_lab_ids = list(
                LabAssignment.objects
                .filter(user=user)
                .filter(Q(start_date__isnull=True) | Q(start_date__lte=today))
                .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
                .values_list('lab_id', flat=True)
                .distinct()
            )
            qs = qs.filter(lab_id__in=assigned_lab_ids)

        data = [
            {
                'id': s.id,
                'unique_code': f'NGSYS-{s.id}',
                'layout_item_id': s.layout_item_id,
                'host_name': s.host_name or (s.layout_item.name if s.layout_item else 'Unknown'),
                'lab_name': s.lab.lab_name if s.lab else None,
                'lab_id': s.lab_id,
                'status': s.status,
            }
            for s in qs
        ]
        return Response(data)


class UserPrivilegesStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        active_incharge_lab_ids = LabAssignment.active_qs().filter(
            role_type=LabAssignment.ROLE_INCHARGE
        ).values_list('lab_id', flat=True)
        active_assistant_lab_ids = LabAssignment.active_qs().filter(
            role_type=LabAssignment.ROLE_ASSISTANT
        ).values_list('lab_id', flat=True)

        user_counts = User.objects.aggregate(
            total_users=Count('id'),
            unassigned_users=Count(Case(When(role='No Roles', then=1), output_field=IntegerField())),
        )
        total_labs = Lab.objects.count()
        config = PrivilegesConfig.get_config()
        return Response({
            **user_counts,
            'total_labs': total_labs,
            'labs_without_instructor': Lab.objects.exclude(id__in=active_incharge_lab_ids).count(),
            'labs_without_assistant': Lab.objects.exclude(id__in=active_assistant_lab_ids).count(),
            'max_labs_per_incharge': config.max_labs_per_incharge,
            'max_labs_per_assistant': config.max_labs_per_assistant,
        })


# ─── Lab Assignment & Privileges Config ───────────────────────────────────────

class LabAssignmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """List all assignments.

        Admins: full list, optionally filtered by ?lab_id=.
        Incharge / Assistant: returns only their own active assignments so
        the frontend can populate a lab-picker on the Reports page.
        """
        user = request.user
        today = timezone.now().date()

        if user.role in ('Lab Incharge', 'Lab Assistant'):
            qs = (
                LabAssignment.objects
                .select_related('lab', 'user', 'assigned_by')
                .filter(user=user)
                .filter(Q(start_date__isnull=True) | Q(start_date__lte=today))
                .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
                .order_by('lab__lab_name')
            )
            return Response(LabAssignmentSerializer(qs, many=True).data)

        if user.role != 'Administrator':
            return Response({'detail': 'Admin only.'}, status=403)

        lab_id = request.GET.get('lab_id')
        qs = LabAssignment.objects.select_related('lab', 'user', 'assigned_by').order_by('-assigned_at')
        if lab_id and lab_id.isdigit():
            qs = qs.filter(lab_id=int(lab_id))
        return Response(LabAssignmentSerializer(qs, many=True).data)

    def post(self, request):
        """Create a new lab assignment (admin only)."""
        if request.user.role != 'Administrator':
            return Response({'detail': 'Admin only.'}, status=403)

        ser = LabAssignmentCreateSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)

        lab = ser.validated_data['lab']
        user = ser.validated_data['user']
        role_type = ser.validated_data['role_type']
        start_date = ser.validated_data.get('start_date')
        end_date = ser.validated_data.get('end_date')

        # Validate that user's role matches the assignment role
        expected_role = 'Lab Incharge' if role_type == LabAssignment.ROLE_INCHARGE else 'Lab Assistant'
        if user.role != expected_role:
            return Response(
                {'detail': f'User must have the "{expected_role}" role to be assigned as {role_type}.'},
                status=400,
            )

        # Validate no overlapping active assignment for same lab + role_type
        today = timezone.now().date()
        effective_start = start_date or today
        overlap_qs = LabAssignment.objects.filter(lab=lab, role_type=role_type).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=(end_date or timezone.datetime.max.date())),
            Q(end_date__isnull=True)   | Q(end_date__gte=effective_start),
        )
        if overlap_qs.exists():
            label = 'Lab Incharge' if role_type == LabAssignment.ROLE_INCHARGE else 'Lab Assistant'
            return Response(
                {'detail': f'This lab already has an active {label} during the selected period.'},
                status=400,
            )

        # Validate per-user concurrent assignment limit
        config = PrivilegesConfig.get_config()
        limit = config.max_labs_per_incharge if role_type == LabAssignment.ROLE_INCHARGE else config.max_labs_per_assistant
        concurrent_count = LabAssignment.objects.filter(user=user, role_type=role_type).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=(end_date or timezone.datetime.max.date())),
            Q(end_date__isnull=True)   | Q(end_date__gte=effective_start),
        ).count()
        if concurrent_count >= limit:
            return Response(
                {'detail': f'This user already has {concurrent_count} concurrent assignment(s) (limit: {limit}).'},
                status=400,
            )

        assignment = ser.save(assigned_by=request.user)

        # Keep M2M in sync for backward compat
        if role_type == LabAssignment.ROLE_INCHARGE:
            lab.instructors.add(user)
        else:
            lab.assistants.add(user)

        return Response(LabAssignmentSerializer(assignment).data, status=201)


class LabAssignmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        """Revoke an assignment (admin only)."""
        if request.user.role != 'Administrator':
            return Response({'detail': 'Admin only.'}, status=403)
        assignment = get_object_or_404(LabAssignment, pk=pk)
        lab = assignment.lab
        user = assignment.user
        role_type = assignment.role_type
        assignment.delete()

        # Remove from M2M only if no other assignments remain for this user+lab
        has_other = LabAssignment.objects.filter(user=user, lab=lab, role_type=role_type).exists()
        if not has_other:
            if role_type == LabAssignment.ROLE_INCHARGE:
                lab.instructors.remove(user)
            else:
                lab.assistants.remove(user)

        return Response(status=204)


class PrivilegesConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = PrivilegesConfig.get_config()
        return Response(PrivilegesConfigSerializer(config).data)

    def patch(self, request):
        if request.user.role != 'Administrator':
            return Response({'detail': 'Admin only.'}, status=403)
        config = PrivilegesConfig.get_config()
        ser = PrivilegesConfigSerializer(config, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        ser.save()
        return Response(PrivilegesConfigSerializer(config).data)


# ─── Delete Account ───────────────────────────────────────────────────────────

class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        LabAssignment.objects.filter(user=user).delete()
        logout(request)
        user.delete()
        return Response({'detail': 'Account permanently deleted.'}, status=status.HTTP_204_NO_CONTENT)


# ─── Profile (password-validated, no OTP) ─────────────────────────────────────

class ProfileUpdateView(APIView):
    """Update profile fields after verifying the user's current password."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError

        user = request.user
        current_password = request.data.get('current_password', '')
        action = request.data.get('action', '').strip()
        new_value = request.data.get('new_value', '').strip()

        # Verify current password
        if not user.check_password(current_password):
            return Response({'current_password': 'Current password is incorrect.'}, status=400)

        valid_actions = ('change_username', 'change_email', 'change_password')
        if action not in valid_actions:
            return Response({'detail': 'Invalid action.'}, status=400)

        if action == 'change_username':
            if not new_value or len(new_value) < 3:
                return Response({'new_value': 'Username must be at least 3 characters.'}, status=400)
            if User.objects.filter(username__iexact=new_value).exclude(pk=user.pk).exists():
                return Response({'new_value': 'This username is already taken.'}, status=400)
            user.username = new_value

        elif action == 'change_email':
            if not new_value:
                return Response({'new_value': 'Email is required.'}, status=400)
            try:
                validate_email(new_value)
            except DjangoValidationError:
                return Response({'new_value': 'Enter a valid email address.'}, status=400)
            if User.objects.filter(email__iexact=new_value).exclude(pk=user.pk).exists():
                return Response({'new_value': 'An account with this email already exists.'}, status=400)
            user.email = new_value.lower()

        elif action == 'change_password':
            if not new_value or len(new_value) < 8:
                return Response({'new_value': 'Password must be at least 8 characters.'}, status=400)
            user.set_password(new_value)

        user.save()

        # Re-login to refresh session after password change
        if action == 'change_password':
            from django.contrib.auth import update_session_auth_hash
            update_session_auth_hash(request, user)

        return Response({'user': UserSerializer(user).data})
