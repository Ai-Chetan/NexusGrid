from django.shortcuts import redirect, render
from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.urls import reverse
from django.core.cache import cache
from django.db.models.functions import TruncMonth
from django.db.models import Count, Q
from django.utils.timezone import now
from datetime import timedelta
import json
import logging

from faults.models import FaultReport
from resources.models import ResourceRequest
from system_layout.models import Lab, System

logger = logging.getLogger(__name__)

@login_required(login_url="/login/")
def dashboard_view(request):
    """
    Main dashboard view with server-side data processing
    """
    try:
        # Get user-specific data
        assistant_labs = []
        if request.user.role == 'Lab Assistant':
            assistant_labs = Lab.objects.filter(
                assistants=request.user
            ).select_related('layout_item')

        # Calculate dashboard metrics on server-side
        dashboard_data = get_dashboard_metrics()
        
        # Generate chart data on server-side
        chart_data = get_chart_data()
        
        # Get recent activity
        recent_activity = get_recent_activity()

        context = {
            'assistant_labs': assistant_labs,
            'dashboard_data': dashboard_data,
            'chart_data': chart_data,
            'recent_activity': recent_activity,
            'page_title': 'Dashboard Overview',
        }

        return render(request, "dashboard/dashboard.html", context)
        
    except Exception as e:
        logger.error(f"Dashboard view error: {str(e)}")
        context = {
            'error_message': 'Unable to load dashboard data. Please try again.',
        }
        return render(request, "dashboard/dashboard.html", context)

def get_dashboard_metrics():
    """
    Calculate all dashboard metrics on server-side
    """
    cache_key = 'dashboard_metrics'
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return cached_data
    
    # System counts
    total_systems = System.objects.count()
    functional_count = System.objects.filter(
        status__in=['active', 'inactive']
    ).count()
    critical_count = System.objects.filter(status='non-functional').count()
    active_count = System.objects.filter(status='active').count()
    
    # Calculate percentages
    if total_systems > 0:
        functional_percent = round((functional_count / total_systems) * 100, 1)
        critical_percent = round((critical_count / total_systems) * 100, 1)
        active_percent = round((active_count / total_systems) * 100, 1)
        system_utilization = round(
            (active_count / (functional_count if functional_count > 0 else 1)) * 100, 1
        )
    else:
        functional_percent = critical_percent = active_percent = system_utilization = 0

    # Recent counts
    fault_reports_count = FaultReport.objects.filter(
        status__in=['open', 'in_progress']
    ).count()
    
    resource_requests_count = ResourceRequest.objects.filter(
        status='pending'
    ).count()

    metrics = {
        'total_systems': total_systems,
        'functional_count': functional_count,
        'critical_count': critical_count,
        'active_count': active_count,
        'functional_percent': functional_percent,
        'critical_percent': critical_percent,
        'active_percent': active_percent,
        'system_utilization': system_utilization,
        'fault_reports_count': fault_reports_count,
        'resource_requests_count': resource_requests_count,
    }
    
    # Cache for 5 minutes
    cache.set(cache_key, metrics, 300)
    return metrics

def get_chart_data():
    """
    Generate chart data on server-side with proper formatting
    """
    cache_key = 'dashboard_charts'
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return cached_data
    
    six_months_ago = now() - timedelta(days=180)
    
    # Fault Trend Chart Data
    fault_trend_data = list(
        FaultReport.objects
        .filter(reported_at__gte=six_months_ago)
        .annotate(month=TruncMonth("reported_at"))
        .values("month")
        .annotate(count=Count("fault_id"))
        .order_by("month")
    )
    
    # Format for frontend consumption
    fault_trend_formatted = {
        'labels': [item['month'].strftime('%b %Y') for item in fault_trend_data],
        'data': [item['count'] for item in fault_trend_data],
        'title': 'Fault Reports Over Time',
        'type': 'line'
    }
    
    # Fault Distribution Chart Data
    fault_distribution_data = list(
        FaultReport.objects
        .values("fault_type")
        .annotate(count=Count("fault_id"))
        .order_by('-count')
    )
    
    fault_distribution_formatted = {
        'labels': [item['fault_type'] for item in fault_distribution_data],
        'data': [item['count'] for item in fault_distribution_data],
        'title': 'Fault Type Distribution',
        'type': 'pie'
    }
    
    # Resource Request Trend
    resource_trend_data = list(
        ResourceRequest.objects
        .filter(requested_at__gte=six_months_ago)
        .annotate(month=TruncMonth("requested_at"))
        .values("month")
        .annotate(count=Count("resource_id"))
        .order_by("month")
    )
    
    resource_trend_formatted = {
        'labels': [item['month'].strftime('%b %Y') for item in resource_trend_data],
        'data': [item['count'] for item in resource_trend_data],
        'title': 'Resource Requests Trend',
        'type': 'bar'
    }
    
    # System Status Distribution
    system_status_data = list(
        System.objects
        .values('status')
        .annotate(count=Count('id'))
    )
    
    system_status_formatted = {
        'labels': [item['status'].title() for item in system_status_data],
        'data': [item['count'] for item in system_status_data],
        'title': 'System Status Distribution',
        'type': 'doughnut'
    }
    
    chart_data = {
        'fault_trend': fault_trend_formatted,
        'fault_distribution': fault_distribution_formatted,
        'resource_trend': resource_trend_formatted,
        'system_status': system_status_formatted,
    }
    
    # Cache for 10 minutes
    cache.set(cache_key, chart_data, 600)
    return chart_data

def get_recent_activity():
    """
    Get recent activity data for the dashboard
    """
    cache_key = 'recent_activity'
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return cached_data
    
    # Get recent fault reports
    recent_faults = FaultReport.objects.filter(
        reported_at__gte=now() - timedelta(hours=24)
    ).order_by('-reported_at')[:5]
    
    # Get recent resource requests
    recent_resources = ResourceRequest.objects.filter(
        requested_at__gte=now() - timedelta(hours=24)
    ).order_by('-requested_at')[:5]
    
    # Format activity data
    activities = []
    
    for fault in recent_faults:
        activities.append({
            'type': 'fault',
            'icon': 'fas fa-exclamation-triangle',
            'title': f'New Fault Report - {fault.fault_type}',
            'description': fault.description[:50] + '...' if len(fault.description) > 50 else fault.description,
            'timestamp': fault.reported_at,
            'time_ago': get_time_ago(fault.reported_at)
        })
    
    for resource in recent_resources:
        activities.append({
            'type': 'resource',
            'icon': 'fas fa-box',
            'color': 'primary',
            'title': f'Resource Request - {resource.resource_type}',
            'description': resource.description[:50] + '...' if len(resource.description) > 50 else resource.description,
            'timestamp': resource.requested_at,
            'time_ago': get_time_ago(resource.requested_at)
        })
    
    # Sort by timestamp and limit to 10
    activities.sort(key=lambda x: x['timestamp'], reverse=True)
    activities = activities[:10]
    
    # Cache for 2 minutes
    cache.set(cache_key, activities, 120)
    return activities

def get_time_ago(timestamp):
    """
    Calculate human-readable time difference
    """
    diff = now() - timestamp
    
    if diff.days > 0:
        return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
    elif diff.seconds > 3600:
        hours = diff.seconds // 3600
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    elif diff.seconds > 60:
        minutes = diff.seconds // 60
        return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
    else:
        return "Just now"

@login_required(login_url="/login/")
def dashboard_api(request):
    """
    API endpoint for AJAX requests (reduced functionality)
    """
    try:
        action = request.GET.get('action', 'metrics')
        
        if action == 'metrics':
            data = get_dashboard_metrics()
        elif action == 'charts':
            data = get_chart_data()
        elif action == 'activity':
            data = get_recent_activity()
        else:
            return JsonResponse({'error': 'Invalid action'}, status=400)
        
        return JsonResponse({
            'success': True,
            'data': data,
            'timestamp': now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Dashboard API error: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': 'Unable to fetch data'
        }, status=500)

@login_required(login_url="/login/")
def qr_scanner_view(request):
    """
    QR Scanner page with server-side validation
    """
    context = {
        'page_title': 'QR Code Scanner',
        'scanner_config': {
            'fps': 10,
            'qrbox': 250,
            'aspectRatio': 1.0
        }
    }
    return render(request, 'dashboard/scan-qr.html', context)

@csrf_exempt
@login_required(login_url="/login/")
def process_qr_scan(request):
    """
    Process QR scan results with server-side validation and routing
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        qr_data = data.get('qr_data', '').strip()
        
        if not qr_data:
            return JsonResponse({'error': 'No QR data provided'}, status=400)
        
        # Log scan attempt
        logger.info(f"QR scan by {request.user.username}: {qr_data}")
        
        # Server-side routing logic
        redirect_url = determine_qr_redirect(qr_data, request.user)
        
        if redirect_url:
            return JsonResponse({
                'success': True,
                'redirect_url': redirect_url,
                'message': 'QR code processed successfully'
            })
        else:
            return JsonResponse({
                'success': False,
                'error': 'Invalid QR code or insufficient permissions'
            }, status=400)
            
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON data'}, status=400)
    except Exception as e:
        logger.error(f"QR processing error: {str(e)}")
        return JsonResponse({'error': 'Processing failed'}, status=500)

def determine_qr_redirect(qr_data, user):
    """
    Determine redirect URL based on QR data and user permissions
    """
    # Check if it's a system ID
    if qr_data.isdigit():
        system_id = int(qr_data)
        
        # Verify system exists and user has access
        try:
            system = System.objects.get(id=system_id)
            
            # Check user permissions based on role
            if user.role == 'Lab Assistant':
                # Check if user is assigned to the lab containing this system
                user_labs = Lab.objects.filter(assistants=user)
                if system.lab in user_labs:
                    return f'/layout/details/{system_id}/'
            elif user.role in ['Administrator', 'Technician']:
                # Full access
                return f'/layout/details/{system_id}/'
                
        except System.DoesNotExist:
            return None
    
    # Check if it's a special QR code format
    if qr_data.startswith('LAB-'):
        lab_code = qr_data.replace('LAB-', '')
        try:
            lab = Lab.objects.get(lab_code=lab_code)
            return f'/lab/{lab.id}/'
        except Lab.DoesNotExist:
            return None
    
    # Fallback for unknown formats
    return None

def user_logout(request):
    """
    Enhanced logout with cleanup
    """
    user_id = request.user.id if request.user.is_authenticated else None
    logout(request)
    
    if user_id:
        # Clear user-specific cache
        cache.delete_many([
            f'user_permissions_{user_id}',
            f'user_labs_{user_id}',
        ])
    
    return redirect('/login/')

# Utility function for error handling
def handle_dashboard_error(request, error_message):
    """
    Centralized error handling for dashboard views
    """
    logger.error(f"Dashboard error for user {request.user.username}: {error_message}")
    
    context = {
        'error_message': error_message,
        'show_retry': True
    }
    
    return render(request, "dashboard/error.html", context)