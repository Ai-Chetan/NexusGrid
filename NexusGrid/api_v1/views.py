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
from .services.notifications import create_notifications, admin_user_ids, lab_assistant_ids_for_lab, create_system_alert_if_needed

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
        password = request.data.get('password', '')
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


def _latest_monitored_hostname_map():
    """Return dict mapping hostname_key -> dict with health_state and last_seen_at (ISO timestamp)."""
    return {
        sc.hostname_key: {
            'health_state': sc.health_state,
            'last_seen_at': sc.last_seen_at.isoformat() if sc.last_seen_at else None,
        }
        for sc in SystemCurrent.objects.all()
    }


def _latest_monitored_hostname_set():
    """Return hostnames that are currently ONLINE in the monitoring current-state table."""
    return set(
        SystemCurrent.objects
        .filter(health_state=SystemCurrent.STATE_ONLINE)
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
    monitoring_map = _latest_monitored_hostname_map()
    online_set = {k for k, v in monitoring_map.items() if v['health_state'] == 'online'}
    return {
        'monitored_hostnames': online_set,
        'monitoring_map': monitoring_map,
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
                # Default status is 'inactive'; promote to 'active' only if
                # the hostname already exists in the monitoring current-state table.
                hostname_key = item.name.strip().lower()
                is_monitored = SystemCurrent.objects.filter(
                    hostname_key=hostname_key
                ).exists()
                System.objects.create(
                    layout_item=item, lab=parent_lab,
                    host_name=item.name, updated_at=timezone.now(),
                    updated_by=request.user,
                    status='active' if is_monitored else 'inactive',
                )
        _notify_admins_layout_change(request.user, 'change (created)', item)
        return Response(LayoutItemSerializer(item, context=_layout_serializer_context()).data, status=201)


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
        return Response(LayoutItemSerializer(item, context=_layout_serializer_context()).data)

    def delete(self, request, pk):
        if request.user.role not in ('Administrator', 'Lab Assistant'):
            return Response({'detail': 'You do not have permission to edit the layout.'}, status=403)
        item = get_object_or_404(LayoutItem, pk=pk)

        # If this layout item has an associated System, remove its monitoring
        # records (SystemCurrent + SystemInfo) so stale data doesn't linger.
        if item.item_type in SYSTEM_TYPES:
            system = getattr(item, 'system', None)
            if system and system.host_name:
                hostname_key = system.host_name.strip().lower()
                SystemCurrent.objects.filter(hostname_key=hostname_key).delete()
                SystemInfo.objects.filter(hostname__iexact=system.host_name.strip()).delete()

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

        # Notify: the active lab assistant for the PC's lab + the requester themselves
        lab_id = fault.system_name.lab_id
        lab_name = fault.system_name.lab.lab_name if fault.system_name.lab else 'Unknown Lab'
        assistant_ids = lab_assistant_ids_for_lab(lab_id)

        recipient_set = set(assistant_ids)
        recipient_set.add(request.user.id)
        recipients = list(recipient_set)

        create_notifications(
            recipient_ids=recipients,
            message=(
                f"{request.user.username} reported a {fault.fault_type} fault on "
                f"{fault.system_name.host_name} ({lab_name}). Risk level: {fault.risk_factor}/5."
            ),
            related_to='fault_report',
            related_id=fault.fault_id,
            target_url=f'/app/faults?highlight={fault.fault_id}',
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

        # Only assistants (fault handlers) can update fault status — admins observe, not resolve.
        if user.role != 'Lab Assistant':
            return Response({'detail': 'Only Lab Assistants can update fault status.'}, status=403)

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
            lab_id = fault.system_name.lab_id
            lab_name = fault.system_name.lab.lab_name if fault.system_name.lab else 'Unknown Lab'
            assistant_ids = lab_assistant_ids_for_lab(lab_id)

            # Notify: the reporter + lab assistant(s)
            recipient_set = set(assistant_ids)
            recipient_set.add(fault.reported_by_id)
            recipients = list(recipient_set)

            status_label = new_status.replace('-', ' ').title()
            create_notifications(
                recipient_ids=recipients,
                message=(
                    f"{user.username} updated fault #{fault.fault_id} on "
                    f"{fault.system_name.host_name} ({lab_name}) to '{status_label}'."
                ),
                related_to='fault_status_update',
                related_id=fault.fault_id,
                target_url=f'/app/faults?highlight={fault.fault_id}',
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

        # Notify: the active lab assistant for the PC's lab + the requester themselves
        lab_id = res.system_name.lab_id
        lab_name = res.system_name.lab.lab_name if res.system_name.lab else 'Unknown Lab'
        assistant_ids = lab_assistant_ids_for_lab(lab_id)

        recipient_set = set(assistant_ids)
        recipient_set.add(request.user.id)
        recipients = list(recipient_set)

        create_notifications(
            recipient_ids=recipients,
            message=(
                f"{request.user.username} requested '{res.resource_name}' "
                f"(qty: {res.quantity}) for {res.system_name.host_name} ({lab_name})."
            ),
            related_to='resource_request',
            related_id=res.resource_id,
            target_url=f'/app/resources?highlight={res.resource_id}',
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
            lab_id = resource.system_name.lab_id
            lab_name = resource.system_name.lab.lab_name if resource.system_name.lab else 'Unknown Lab'
            assistant_ids = lab_assistant_ids_for_lab(lab_id)

            # Notify: the requester + lab assistant(s)
            recipient_set = set(assistant_ids)
            recipient_set.add(resource.requested_by_id)
            recipients = list(recipient_set)

            create_notifications(
                recipient_ids=recipients,
                message=(
                    f"{user.username} marked resource request #{resource.resource_id} "
                    f"('{resource.resource_name}' for {resource.system_name.host_name}, {lab_name}) "
                    f"as '{new_status}'."
                ),
                related_to='resource_status_update',
                related_id=resource.resource_id,
                target_url=f'/app/resources?highlight={resource.resource_id}',
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
        start_date = request.GET.get('start_date', '').strip() or None
        end_date = request.GET.get('end_date', '').strip() or None
        return Response(get_report_metrics(lab_ids=lab_ids, start_date=start_date, end_date=end_date))


class ReportsDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import datetime as _dt

        if request.user.role == 'Lab Incharge':
            return Response({'detail': 'Reports are not available for Lab Incharge.'}, status=403)
        lab_ids = _resolve_report_lab_scope(request.user, request.GET)

        # Parse optional date range
        start_date_str = request.GET.get('start_date', '').strip()
        end_date_str = request.GET.get('end_date', '').strip()
        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = _dt.strptime(start_date_str, '%Y-%m-%d').date()
            if end_date_str:
                end_date = _dt.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            pass

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

        # Apply date range filters
        if start_date:
            faults_qs = faults_qs.filter(reported_at__date__gte=start_date)
            resources_qs = resources_qs.filter(requested_at__date__gte=start_date)
        if end_date:
            faults_qs = faults_qs.filter(reported_at__date__lte=end_date)
            resources_qs = resources_qs.filter(requested_at__date__lte=end_date)

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


class MaintenanceSummaryView(APIView):
    """Weekly/monthly maintenance summary.

    ?period=weekly|monthly (default monthly), optional ?start=&end=.
    ?user_id= scopes to one staff member's work (faults reported/resolved,
    resources requested/fulfilled by them). ?lab_id= scopes to one lab.
    Administrators: any scope. Lab Assistants: their own work by default,
    or one of their currently assigned labs.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models.functions import TruncWeek, TruncMonth

        user = request.user
        if user.role not in ('Administrator', 'Lab Assistant'):
            return Response({'detail': 'Reports are not available for this role.'}, status=403)

        period = request.GET.get('period', 'monthly').strip().lower()
        if period not in ('weekly', 'monthly'):
            return Response({'detail': 'period must be weekly or monthly.'}, status=400)
        trunc = TruncWeek if period == 'weekly' else TruncMonth
        label_fmt = 'Week of %d %b %Y' if period == 'weekly' else '%b %Y'

        start, end = _parse_range(request.GET)
        lab_id = request.GET.get('lab_id', '').strip()
        user_id = request.GET.get('user_id', '').strip()
        if lab_id and not lab_id.isdigit():
            return Response({'detail': 'lab_id must be numeric.'}, status=400)
        if user_id and not user_id.isdigit():
            return Response({'detail': 'user_id must be numeric.'}, status=400)

        if user.role == 'Lab Assistant':
            if user_id and user_id != str(user.id):
                return Response({'detail': 'Assistants can only view their own summary.'}, status=403)
            if lab_id:
                today = timezone.now().date()
                assigned = set(
                    LabAssignment.objects.filter(user=user)
                    .filter(Q(start_date__isnull=True) | Q(start_date__lte=today))
                    .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
                    .values_list('lab_id', flat=True)
                )
                if int(lab_id) not in assigned:
                    return Response({'detail': 'You can only view labs assigned to you.'}, status=403)
            else:
                user_id = str(user.id)

        reported = FaultReport.objects.all()
        resolved = FaultReport.objects.filter(status='resolved', resolved_at__isnull=False)
        requested = ResourceRequest.objects.all()
        fulfilled = ResourceRequest.objects.filter(status='Fulfilled', provided_at__isnull=False)
        scope = {}

        if user_id:
            target = get_object_or_404(User, pk=int(user_id))
            reported = reported.filter(reported_by=target)
            resolved = resolved.filter(resolved_by=target)
            requested = requested.filter(requested_by=target)
            fulfilled = fulfilled.filter(provided_by=target)
            scope['user'] = {'id': target.id, 'username': target.username, 'role': target.role}

        if lab_id:
            lab = get_object_or_404(Lab, pk=int(lab_id))
            reported = reported.filter(system_name__lab=lab)
            resolved = resolved.filter(system_name__lab=lab)
            requested = requested.filter(system_name__lab=lab)
            fulfilled = fulfilled.filter(system_name__lab=lab)
            scope['lab'] = {'id': lab.id, 'name': lab.lab_name}

        if start:
            reported = reported.filter(reported_at__date__gte=start)
            resolved = resolved.filter(resolved_at__date__gte=start)
            requested = requested.filter(requested_at__date__gte=start)
            fulfilled = fulfilled.filter(provided_at__date__gte=start)
        if end:
            reported = reported.filter(reported_at__date__lte=end)
            resolved = resolved.filter(resolved_at__date__lte=end)
            requested = requested.filter(requested_at__date__lte=end)
            fulfilled = fulfilled.filter(provided_at__date__lte=end)

        def bucket(qs, field, id_field):
            return {
                row['p']: row['n']
                for row in qs.annotate(p=trunc(field)).values('p').annotate(n=Count(id_field))
                if row['p'] is not None
            }

        b_reported = bucket(reported, 'reported_at', 'fault_id')
        b_resolved = bucket(resolved, 'resolved_at', 'fault_id')
        b_requested = bucket(requested, 'requested_at', 'resource_id')
        b_fulfilled = bucket(fulfilled, 'provided_at', 'resource_id')

        keys = sorted(set(b_reported) | set(b_resolved) | set(b_requested) | set(b_fulfilled))
        rows = [{
            'period': k.strftime(label_fmt),
            'faults_reported': b_reported.get(k, 0),
            'faults_resolved': b_resolved.get(k, 0),
            'resources_requested': b_requested.get(k, 0),
            'resources_fulfilled': b_fulfilled.get(k, 0),
        } for k in keys]

        return Response({
            'period': period,
            'start': start.isoformat() if start else None,
            'end': end.isoformat() if end else None,
            'scope': scope,
            'generated_at': timezone.now().isoformat(),
            'rows': rows,
            'totals': {
                'faults_reported': sum(b_reported.values()),
                'faults_resolved': sum(b_resolved.values()),
                'resources_requested': sum(b_requested.values()),
                'resources_fulfilled': sum(b_fulfilled.values()),
            },
        })


class ReplacementCostReportView(APIView):
    """Admin-only: replacement/resource requests raised by lab assistants,
    grouped by department (building), with per-part and total costs.

    Read-only payload consumed by the printable report. Optional
    ?start=&end= and ?status=Pending|Fulfilled|Denied filters.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _admin_only(request)
        if denied:
            return denied

        start, end = _parse_range(request.GET)
        qs = (
            ResourceRequest.objects
            .filter(requested_by__role='Lab Assistant')
            .select_related(
                'system_name', 'system_name__lab', 'system_name__lab__layout_item',
                'system_name__lab__layout_item__parent',
                'system_name__lab__layout_item__parent__parent',
                'requested_by',
            )
            .order_by('requested_at')
        )
        if start:
            qs = qs.filter(requested_at__date__gte=start)
        if end:
            qs = qs.filter(requested_at__date__lte=end)
        status_param = request.GET.get('status', '').strip()
        if status_param in ('Pending', 'Fulfilled', 'Denied'):
            qs = qs.filter(status=status_param)

        departments = {}
        grand_total = 0.0
        for r in qs:
            lab = r.system_name.lab
            room = getattr(lab, 'layout_item', None) if lab else None
            floor = getattr(room, 'parent', None) if room else None
            building = getattr(floor, 'parent', None) if floor else None
            dept = building.name if building else 'Unassigned'
            unit_cost = float(r.cost) if r.cost is not None else None
            line_total = round(unit_cost * r.quantity, 2) if unit_cost is not None else None
            d = departments.setdefault(dept, {
                'department': dept, 'items': [], 'subtotal': 0.0, 'items_without_cost': 0,
            })
            d['items'].append({
                'resource_id': r.resource_id,
                'requested_at': r.requested_at.isoformat(),
                'resource_name': r.resource_name,
                'system_name': r.system_name.host_name or '',
                'lab_name': lab.lab_name if lab else '',
                'requested_by': r.requested_by.username,
                'quantity': r.quantity,
                'unit_cost': unit_cost,
                'line_total': line_total,
                'status': r.status,
            })
            if line_total is not None:
                d['subtotal'] = round(d['subtotal'] + line_total, 2)
                grand_total = round(grand_total + line_total, 2)
            else:
                d['items_without_cost'] += 1

        return Response({
            'start': start.isoformat() if start else None,
            'end': end.isoformat() if end else None,
            'generated_at': timezone.now().isoformat(),
            'departments': sorted(departments.values(), key=lambda d: d['department']),
            'grand_total': grand_total,
        })


class PcStatusOverviewView(APIView):
    """Admin-only: overall PC/system counts — total, working, not working,
    inactive, and under maintenance (open in-progress/scheduled fault),
    plus a per-lab breakdown.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _admin_only(request)
        if denied:
            return denied

        by_status = dict(
            System.objects.values('status').annotate(n=Count('id')).values_list('status', 'n')
        )
        maintenance_ids = set(
            FaultReport.objects
            .filter(status__in=['in-progress', 'scheduled'])
            .values_list('system_name_id', flat=True)
        )

        lab_rows = (
            System.objects
            .filter(lab__isnull=False)
            .values('id', 'status', 'lab_id', 'lab__lab_name')
            .order_by('lab__lab_name')
        )
        grouped = {}
        for row in lab_rows:
            g = grouped.setdefault(row['lab_id'], {
                'lab_id': row['lab_id'], 'lab_name': row['lab__lab_name'],
                'total': 0, 'working': 0, 'inactive': 0, 'not_working': 0, 'under_maintenance': 0,
            })
            g['total'] += 1
            if row['status'] == 'active':
                g['working'] += 1
            elif row['status'] == 'inactive':
                g['inactive'] += 1
            elif row['status'] == 'non-functional':
                g['not_working'] += 1
            if row['id'] in maintenance_ids:
                g['under_maintenance'] += 1
        per_lab = sorted(grouped.values(), key=lambda g: g['lab_name'])

        return Response({
            'generated_at': timezone.now().isoformat(),
            'total': System.objects.count(),
            'working': by_status.get('active', 0),
            'inactive': by_status.get('inactive', 0),
            'not_working': by_status.get('non-functional', 0),
            'under_maintenance': len(maintenance_ids),
            'by_status': by_status,
            'per_lab': per_lab,
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

        from monitoring.views import sync_host_health_states, compute_canonical_device_status
        from faults.models import FaultReport
        from resources.models import ResourceRequest

        # Synchronize online/offline health states based on configurable threshold
        sync_host_health_states()

        # Build lookups for active faults, pending resources, and system status
        active_fault_hosts = set(
            (h or '').strip().lower()
            for h in FaultReport.objects.filter(status__in=['unaddressed', 'in-progress', 'scheduled'])
            .values_list('system_name__host_name', flat=True) if h
        )
        pending_resource_hosts = set(
            (h or '').strip().lower()
            for h in ResourceRequest.objects.filter(status='Pending')
            .values_list('system_name__host_name', flat=True) if h
        )
        system_status_map = {
            (s.host_name or '').strip().lower(): s.status
            for s in System.objects.all() if s.host_name
        }

        current_rows = list(SystemCurrent.objects.select_related('latest_info').order_by('hostname'))

        is_assistant = request.user.role == 'Lab Assistant'
        if is_assistant:
            assigned_hostnames = {
                (h or '').strip().lower()
                for h in System.objects
                .filter(lab_id__in=_assigned_lab_ids(request.user))
                .values_list('host_name', flat=True)
            }
            current_rows = [r for r in current_rows if (r.hostname or '').strip().lower() in assigned_hostnames]

        systems = []
        for row in current_rows:
            if row.latest_info_id and row.latest_info:
                info = row.latest_info
                info.health_state = row.health_state
                h_key = (info.hostname or '').strip().lower()
                has_fault = h_key in active_fault_hosts
                explicit = system_status_map.get(h_key)
                
                info.status = compute_canonical_device_status(
                    last_seen_at=row.last_seen_at,
                    health_state=row.health_state,
                    explicit_status=explicit,
                    has_active_fault=has_fault,
                )
                
                if has_fault:
                    info.alert_status = 'fault_active'
                elif h_key in pending_resource_hosts:
                    info.alert_status = 'resource_pending'
                else:
                    info.alert_status = None
                
                create_system_alert_if_needed(
                    hostname=info.hostname,
                    memory_usage_percent=info.memory_usage_percent,
                )
                systems.append(info)

        data = {'systems': SystemInfoSerializer(systems, many=True).data}
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


class UptimeMonthlyView(APIView):
    """Return monthly uptime statistics for a system.

    For each month, provides the average daily uptime (hours) and a breakdown
    of each active day's uptime. Days with zero uptime are excluded.

    Query params:
      - item_id (required): LayoutItem ID
      - months (optional): number of past months to return (default 6, max 12)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import datetime, timedelta
        from collections import defaultdict

        item_id = request.GET.get('item_id', '').strip()
        if not item_id.isdigit():
            return Response({'detail': 'item_id is required.'}, status=400)

        months_limit = 6
        months_raw = request.GET.get('months', '6').strip()
        try:
            months_limit = int(months_raw)
        except ValueError:
            pass
        months_limit = max(1, min(months_limit, 12))

        item = get_object_or_404(
            LayoutItem.objects.select_related('system'),
            pk=int(item_id),
        )
        system = getattr(item, 'system', None)
        hostname = (system.host_name if system else item.name) or ''
        hostname = hostname.strip()
        if not hostname:
            return Response({'detail': 'No hostname found for this item.'}, status=404)

        # Fetch snapshots with uptime data from the last N months
        cutoff = timezone.now() - timedelta(days=months_limit * 31)
        snapshots = list(
            SystemInfo.objects
            .filter(hostname__iexact=hostname)
            .filter(timestamp__gte=cutoff)
            .filter(uptime_seconds__isnull=False)
            .order_by('timestamp')
            .values('timestamp', 'boot_time', 'uptime_seconds')
        )

        if not snapshots:
            return Response({
                'item_id': item.id,
                'hostname': hostname,
                'months': [],
            })

        # ── Calculate daily uptime ──────────────────────────────────────────
        # Group snapshots by calendar date
        day_snapshots = defaultdict(list)
        for snap in snapshots:
            ts = snap['timestamp']
            day_key = ts.strftime('%Y-%m-%d')
            day_snapshots[day_key].append(snap)

        daily_uptime = {}  # date_str -> hours
        for day_key, snaps in day_snapshots.items():
            # Group by boot_time to handle reboots within a day
            sessions = defaultdict(list)
            for s in snaps:
                sessions[s['boot_time']].append(s['uptime_seconds'])

            total_seconds = 0.0
            day_start_ts = datetime.strptime(day_key, '%Y-%m-%d').replace(
                tzinfo=snaps[0]['timestamp'].tzinfo
            )
            day_start_epoch = day_start_ts.timestamp()

            for boot_time, uptime_list in sessions.items():
                min_up = min(uptime_list)
                max_up = max(uptime_list)
                if boot_time >= day_start_epoch:
                    # Session started today: total uptime from boot to last snapshot
                    total_seconds += max_up
                else:
                    # Session was already running: elapsed time during this day
                    total_seconds += (max_up - min_up)

            hours = round(total_seconds / 3600.0, 2)
            if hours > 0:
                daily_uptime[day_key] = hours

        # ── Group by month ──────────────────────────────────────────────────
        month_data = defaultdict(list)
        for day_key, hours in sorted(daily_uptime.items()):
            month_key = day_key[:7]  # YYYY-MM
            month_data[month_key].append({'date': day_key, 'uptime_hours': hours})

        months_result = []
        for month_key in sorted(month_data.keys()):
            days = month_data[month_key]
            active_days = len(days)
            total_hours = round(sum(d['uptime_hours'] for d in days), 2)
            avg_hours = round(total_hours / active_days, 2) if active_days > 0 else 0

            # Parse month label
            try:
                dt = datetime.strptime(month_key, '%Y-%m')
                month_label = dt.strftime('%b %Y')
            except ValueError:
                month_label = month_key

            months_result.append({
                'month': month_key,
                'month_label': month_label,
                'avg_daily_hours': avg_hours,
                'total_hours': total_hours,
                'active_days': active_days,
                'days': days,
            })

        return Response({
            'item_id': item.id,
            'hostname': hostname,
            'months': months_result,
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
        if user.is_superuser and not request.user.is_superuser:
            return Response({'detail': 'Only a superuser can delete another superuser.'}, status=403)
        username = user.username
        # Revoke lab assignments first (explicit; CASCADE would also cover this)
        LabAssignment.objects.filter(user=user).delete()
        user.delete()
        from django.core.cache import cache
        cache.delete(USER_LIST_CACHE_KEY)
        # 200 not 204 — clients need the body for toast messaging
        return Response({'detail': f'User "{username}" deleted.'})



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

        # Validate against per-lab slot limit for this role (admin-configurable)
        config = PrivilegesConfig.get_config()
        today = timezone.now().date()
        effective_start = start_date or today
        overlap_qs = LabAssignment.objects.filter(lab=lab, role_type=role_type).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=(end_date or timezone.datetime.max.date())),
            Q(end_date__isnull=True)   | Q(end_date__gte=effective_start),
        )
        label = 'Lab Incharge' if role_type == LabAssignment.ROLE_INCHARGE else 'Lab Assistant'
        if overlap_qs.filter(user=user).exists():
            return Response(
                {'detail': f'{user.username} is already assigned as {label} for this lab during the selected period.'},
                status=400,
            )
        per_lab_limit = config.max_incharges_per_lab if role_type == LabAssignment.ROLE_INCHARGE else config.max_assistants_per_lab
        if overlap_qs.count() >= per_lab_limit:
            return Response(
                {'detail': f'This lab already has {overlap_qs.count()} active {label}(s) during the selected period (limit: {per_lab_limit}).'},
                status=400,
            )

        # Validate per-user concurrent assignment limit
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

# ─── Analytics Drill-Down ──────────────────────────────────────────────────

def _get_hostname(request):
    item_id = request.GET.get('item_id', '').strip()
    if not item_id.isdigit():
        return None, Response({'detail': 'item_id is required.'}, status=400)
    item = get_object_or_404(LayoutItem.objects.select_related('system'), pk=int(item_id))
    system = getattr(item, 'system', None)
    hostname = (system.host_name if system else item.name) or ''
    hostname = hostname.strip()
    if not hostname:
        return None, Response({'detail': 'No hostname found for this item.'}, status=404)
    return hostname, None

def _calculate_daily_uptime(snapshots, day_start_ts=None):
    from collections import defaultdict
    from datetime import datetime
    sessions = defaultdict(list)
    for s in snapshots:
        sessions[s['boot_time']].append(s['timestamp'].timestamp())
    total_seconds = 0.0
    for boot_time, timestamps in sessions.items():
        if boot_time is None:
            timestamps.sort()
            acc = 0.0
            for i in range(1, len(timestamps)):
                gap = timestamps[i] - timestamps[i-1]
                if 0 < gap < 300:
                    acc += gap
            total_seconds += acc
            continue

        min_seen = min(timestamps)
        max_seen = max(timestamps)
        if day_start_ts is None:
            first_dt = datetime.fromtimestamp(min_seen, tz=snapshots[0]['timestamp'].tzinfo)
            day_start = first_dt.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
        else:
            day_start = day_start_ts
        if boot_time >= day_start:
            total_seconds += max(0, max_seen - boot_time)
        else:
            total_seconds += max(0, max_seen - min_seen)
    return total_seconds

class AnalyticsYearlyView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        from collections import defaultdict
        hostname, err = _get_hostname(request)
        if err: return err
        snapshots = list(
            SystemInfo.objects
            .filter(hostname__iexact=hostname)
            .values('timestamp', 'boot_time')
        )
        yearly_data = defaultdict(lambda: defaultdict(list))
        for snap in snapshots:
            dt = snap['timestamp']
            yearly_data[dt.year][dt.strftime('%Y-%m-%d')].append(snap)
        results = []
        from datetime import datetime
        for year, days in sorted(yearly_data.items()):
            active_days = len(days)
            total_yearly_seconds = 0.0
            for day_key, snaps in days.items():
                day_start = datetime.strptime(day_key, '%Y-%m-%d').replace(tzinfo=snaps[0]['timestamp'].tzinfo).timestamp()
                total_yearly_seconds += _calculate_daily_uptime(snaps, day_start)
            total_hours = total_yearly_seconds / 3600.0
            avg_hours = round(total_hours / active_days, 2) if active_days > 0 else 0
            results.append({
                'year': year,
                'avg_daily_hours': avg_hours,
                'active_days': active_days,
                'total_hours': round(total_hours, 2)
            })
        return Response({'item_id': int(request.GET.get('item_id')), 'hostname': hostname, 'years': results})

class AnalyticsMonthlyView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        from collections import defaultdict
        hostname, err = _get_hostname(request)
        if err: return err
        year_str = request.GET.get('year', str(timezone.now().year))
        try:
            year = int(year_str)
        except:
            return Response({'detail': 'Invalid year'}, status=400)
        snapshots = list(
            SystemInfo.objects
            .filter(hostname__iexact=hostname, timestamp__year=year)
            .values('timestamp', 'boot_time')
        )
        monthly_data = defaultdict(lambda: defaultdict(list))
        for snap in snapshots:
            dt = snap['timestamp']
            monthly_data[dt.month][dt.strftime('%Y-%m-%d')].append(snap)
        results = []
        from datetime import datetime
        for month in range(1, 13):
            days = monthly_data.get(month, {})
            active_days = len(days)
            total_monthly_seconds = 0.0
            for day_key, snaps in days.items():
                day_start = datetime.strptime(day_key, '%Y-%m-%d').replace(tzinfo=snaps[0]['timestamp'].tzinfo).timestamp()
                total_monthly_seconds += _calculate_daily_uptime(snaps, day_start)
            total_hours = total_monthly_seconds / 3600.0
            avg_hours = round(total_hours / active_days, 2) if active_days > 0 else 0
            results.append({
                'month': month,
                'month_label': datetime(year, month, 1).strftime('%B'),
                'avg_daily_hours': avg_hours,
                'active_days': active_days,
                'total_hours': round(total_hours, 2)
            })
        return Response({'item_id': int(request.GET.get('item_id')), 'hostname': hostname, 'year': year, 'months': results})

class AnalyticsDailyView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        from collections import defaultdict
        hostname, err = _get_hostname(request)
        if err: return err
        try:
            year = int(request.GET.get('year', timezone.now().year))
            month = int(request.GET.get('month', timezone.now().month))
        except:
            return Response({'detail': 'Invalid year or month'}, status=400)
        snapshots = list(
            SystemInfo.objects
            .filter(hostname__iexact=hostname, timestamp__year=year, timestamp__month=month)
            .values('timestamp', 'boot_time')
        )
        daily_data = defaultdict(list)
        for snap in snapshots:
            daily_data[snap['timestamp'].day].append(snap)
        import calendar
        from datetime import datetime
        _, num_days = calendar.monthrange(year, month)
        results = []
        for day in range(1, num_days + 1):
            snaps = daily_data.get(day, [])
            total_hours = 0.0
            if snaps:
                day_key = f"{year}-{month:02d}-{day:02d}"
                day_start = datetime.strptime(day_key, '%Y-%m-%d').replace(tzinfo=snaps[0]['timestamp'].tzinfo).timestamp()
                total_hours = _calculate_daily_uptime(snaps, day_start) / 3600.0
            results.append({
                'day': day,
                'date': f"{year}-{month:02d}-{day:02d}",
                'total_hours': round(total_hours, 2),
                'active': len(snaps) > 0,
                'boot_sessions': len(set(s['boot_time'] for s in snaps)) if snaps else 0
            })
        return Response({'item_id': int(request.GET.get('item_id')), 'hostname': hostname, 'year': year, 'month': month, 'days': results})

class AnalyticsIntradayView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        hostname, err = _get_hostname(request)
        if err: return err
        date_str = request.GET.get('date')
        if not date_str:
            return Response({'detail': 'Date is required'}, status=400)
        from datetime import datetime
        try:
            dt = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return Response({'detail': 'Invalid date format'}, status=400)
        snapshots = list(
            SystemInfo.objects
            .filter(hostname__iexact=hostname, timestamp__date=dt.date())
            .order_by('timestamp')
            .values('timestamp', 'boot_time')
        )
        timeline = []
        if snapshots:
            current_block = None
            for snap in snapshots:
                ts = snap['timestamp'].timestamp()
                if not current_block:
                    current_block = {'start': ts, 'end': ts, 'boot_time': snap['boot_time'] or ts}
                else:
                    if snap['boot_time'] != current_block.get('original_boot_time') or (ts - current_block['end']) > 300:
                        timeline.append(current_block)
                        current_block = {'start': ts, 'end': ts, 'boot_time': snap['boot_time'] or ts, 'original_boot_time': snap['boot_time']}
                    else:
                        current_block['end'] = ts
            if current_block:
                timeline.append(current_block)
        return Response({'item_id': int(request.GET.get('item_id')), 'hostname': hostname, 'date': date_str, 'timeline': timeline})
