// ─── Roles & Users ────────────────────────────────────────────────────────────

export type Role =
  | 'Administrator'
  | 'Lab Incharge'
  | 'Lab Assistant'
  | 'Students'
  | 'No Roles';

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
  assigned_labs: string[];
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignUpRequest {
  username: string;
  email: string;
  password: string;
  password2: string;
  role?: string;
}

// ─── Layout & Systems ─────────────────────────────────────────────────────────

export interface SimpleSystem {
  id: number;
  host_name: string;
  unique_code: string;
  layout_item_id: number | null;
  lab_name?: string;
}

export interface System {
  id: number;
  host_name: string;
  lab_name?: string;
}

export interface LayoutItem {
  id: number;
  name: string;
  item_type: string;
  parent: number | null;
  parent_name: string | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
  status?: string | null;
  quick_info?: Record<string, unknown> | null;
  monitoring_status?: string | null;
  alert_status?: string | null;
}

export interface BreadcrumbItem {
  id: number;
  name: string;
  item_type: string;
}

export interface LayoutSystem {
  id: number;
  host_name: string;
  unique_code: string;
  status: 'operational' | 'faulty' | 'maintenance' | 'offline';
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  lab_name: string;
  orientation?: 'horizontal' | 'vertical';
  last_boot?: string | null;
}

export interface LabZone {
  id: number;
  name: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  systems: LayoutSystem[];
}

export interface LayoutData {
  labs: LabZone[];
}

export interface Lab {
  id: number;
  lab_name: string;
  lab_code: string | null;
  location: string | null;
  capacity: number | null;
  dimension: string | null;
  quick_info: Record<string, unknown>;
  layout_item_id: number | null;
  layout_item_name: string | null;
  floor_id: number | null;
  parent_name: string | null;
  building_name: string | null;
  systems_count: number;
  current_incharge: CurrentAssignment | null;
  current_assistant: CurrentAssignment | null;
  current_incharges?: CurrentAssignment[];
  current_assistants?: CurrentAssignment[];
}

// ─── Faults ───────────────────────────────────────────────────────────────────

export type FaultType = 'Hardware' | 'Software' | 'Network';

export type FaultStatus =
  | 'unaddressed'
  | 'in-progress'
  | 'scheduled'
  | 'resolved'
  | 'ignored';

export interface FaultReport {
  fault_id: number;
  system_name: number;
  system_host_name: string;
  lab_name?: string;
  reported_by: number;
  reported_by_username: string;
  fault_type: FaultType;
  risk_factor: number;
  description: string;
  status: FaultStatus;
  reported_at: string;
  resolved?: {
    resolution_summary: string;
    resolved_by_username: string | null;
    resolved_at: string;
  } | null;
}

export interface FaultCreateRequest {
  system_id: number;
  fault_type: string;
  risk_factor?: number;
  description: string;
}

export interface FaultStatusUpdateRequest {
  status?: FaultStatus;
  resolution_summary?: string;
}

// ─── Resources ────────────────────────────────────────────────────────────────

export type ResourceStatus = 'Pending' | 'Fulfilled' | 'Denied';

export interface ResourceRequest {
  resource_id: number;
  system_name: number;
  system_host_name: string;
  lab_name?: string;
  requested_by: number;
  requested_by_username: string;
  resource_name: string;
  description: string;
  quantity: number;
  cost: number | null;
  line_total: number | null;
  status: ResourceStatus;
  requested_at: string;
  provided?: {
    provision_summary: string;
    provided_by_username: string | null;
    provided_at: string;
  } | null;
}

export interface ResourceItem {
  id: number;
  name: string;
  resource_type: 'projector' | 'printer' | 'scanner' | 'router' | 'switch' | 'ups' | 'other';
  status: 'available' | 'in_use' | 'maintenance' | 'faulty';
  lab: number | null;
  lab_name: string | null;
  description: string;
  last_checked: string | null;
  checked_by: number | null;
  checked_by_username: string | null;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationRelatedTo =
  | 'fault_report'
  | 'fault_status_update'
  | 'resource_request'
  | 'resource_status_update'
  | 'admin_message'
  | 'system_alert';

export interface NotificationItem {
  id: number;
  created_by: number | null;
  created_by_username: string | null;
  recipient: number;
  message: string;
  related_to: NotificationRelatedTo;
  related_id: number | null;
  target_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Notification {
  id: number;
  sender: number;
  sender_username: string;
  message: string;
  notification_type: 'broadcast' | 'assignment' | 'fault_update' | 'system_alert' | 'info';
  created_at: string;
  is_read: boolean;
  read_at: string | null;
  related_fault: number | null;
  related_assignment: number | null;
}

export interface BroadcastRequest {
  message: string;
  target_role?: string | null;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: T[];
}

// ─── Lab Assignments & Privileges ─────────────────────────────────────────────

export interface CurrentAssignment {
  assignment_id: number;
  user_id: number;
  username: string;
  start_date: string | null;
  end_date: string | null;
}

export interface LabAssignment {
  id: number;
  lab: number;
  lab_name: string;
  user: number;
  username: string;
  user_email: string;
  role_type: 'incharge' | 'assistant';
  assigned_by: number | null;
  assigned_by_username: string | null;
  assigned_at: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

export interface PrivilegesConfig {
  max_labs_per_incharge: number;
  max_labs_per_assistant: number;
  max_incharges_per_lab: number;
  max_assistants_per_lab: number;
}

export interface PrivilegesConfigUpdateRequest {
  max_labs_per_incharge?: number;
  max_labs_per_assistant?: number;
  max_incharges_per_lab?: number;
  max_assistants_per_lab?: number;
}

export interface Assignment {
  id: number;
  user: number;
  username: string;
  user_role: string;
  lab: number;
  lab_name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

export interface AssignmentCreateRequest {
  user: number;
  lab: number;
  role_type?: string;
  start_date?: string | null;
  end_date?: string | null;
}

// ─── Monitoring Configuration ─────────────────────────────────────────────────

export interface MonitoringConfig {
  heartbeat_interval_minutes: number;
  offline_detection_threshold_minutes: number;
  max_log_retention_days: number;
  updated_at: string;
}

export interface MonitoringConfigUpdateRequest {
  heartbeat_interval_minutes?: number;
  offline_detection_threshold_minutes?: number;
  max_log_retention_days?: number;
}

// ─── Monitoring / System Info ─────────────────────────────────────────────────

export interface GpuStat {
  gpu_id: number;
  gpu_name: string;
  gpu_load_percent: number | null;
  gpu_memory_used: number;
  gpu_memory_total: number;
  gpu_memory_percent: number | null;
  gpu_temperature: number | null;
}

export interface SystemInfo {
  id: number;
  hostname: string;
  ip_address: string | null;
  system: string | null;
  version: string | null;
  release: string | null;
  machine: string | null;
  processor: string | null;
  architecture: string | null;
  cpu_physical_cores: number | null;
  cpu_total_cores: number | null;
  cpu_max_freq: number | null;
  cpu_min_freq: number | null;
  cpu_current_freq: number | null;
  cpu_usage: number | null;
  cpu_load_avg: unknown;
  memory_total: number | null;
  memory_available: number | null;
  memory_used: number | null;
  memory_usage_percent: number | null;
  swap_total: number | null;
  swap_used: number | null;
  swap_usage_percent: number | null;
  disk_total: number | null;
  disk_used: number | null;
  disk_free: number | null;
  disk_usage_percent: number | null;
  disk_read_bytes: number | null;
  disk_write_bytes: number | null;
  bytes_sent: number | null;
  bytes_received: number | null;
  top_processes: unknown;
  users_count: number | null;
  logged_in_users: string | null;
  gpu_available?: boolean | null;
  gpu_stats?: GpuStat[] | null;
  boot_time: number | null;
  uptime_seconds: number | null;
  today_uptime_seconds: number | null;
  today_uptime_formatted: string | null;
  today_date: string | null;
  timestamp: string;
  ram_usage?: number | null;
  disk_usage?: number | null;
}

export interface MonitoringHistoryResponse {
  history: SystemInfo[];
}

export interface MonitoringItem {
  id: number;
  hostname: string;
  last_boot_time: string | null;
  total_uptime_minutes: number;
  status: 'online' | 'offline';
  current_session_start: string | null;
  boot_count_today: number;
}

export interface MonitoringResponse {
  data: MonitoringItem[];
  last_updated: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardFilterParams {
  building_id?: number;
  floor_id?: number;
  room_id?: number;
  start_date?: string;
  end_date?: string;
}

export interface DashboardSystemMetrics {
  total: number;
  functional: number;
  critical: number;
  active: number;
  functional_pct: number;
  critical_pct: number;
  active_pct: number;
  utilization_pct: number;
}

export interface DashboardActivityItem {
  type: 'fault' | 'resource';
  id: number;
  title: string;
  subtitle: string;
  status: string;
  time: string;
  user: string;
  assignee: string | null;
}

export interface DashboardMetrics {
  systems: DashboardSystemMetrics;
  faults: { total: number; open: number };
  resources: { total: number; fulfilled: number; pending: number };
  labs_total: number;
  fault_trend: { month: string; count: number }[];
  resource_trend: { month: string; count: number }[];
  fault_by_type: Record<string, number>;
  fault_by_status: Record<string, number>;
  recent_activity: DashboardActivityItem[];
  today?: {
    faults_reported: number;
    faults_resolved: number;
    resources_requested: number;
    resources_fulfilled: number;
  };
}

export interface DashboardStats {
  total_systems: number;
  operational_count: number;
  faulty_count: number;
  maintenance_count: number;
  offline_count: number;
  active_fault_reports: number;
  resolved_today: number;
  active_lab_sessions: number;
  pending_assignments: number;
}

export interface LabSession {
  id: number;
  lab_name: string;
  incharge_name: string | null;
  assistant_name: string | null;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
}

export interface DashboardData {
  stats: DashboardStats;
  recent_faults: FaultReport[];
  active_sessions: LabSession[];
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface ReportsData {
  fault_by_status: Record<string, number>;
  fault_by_type: Record<string, number>;
  resource_by_status: Record<string, number>;
  system_by_status: Record<string, number>;
  fault_monthly: { month: string; type: string; count: number }[];
  resource_monthly: { month: string; count: number }[];
  summary?: {
    total_systems: number;
    active_systems: number;
    inactive_systems: number;
    non_functional_systems: number;
    total_faults: number;
    open_faults: number;
    total_resources: number;
    pending_resources: number;
  };
}

export interface ReportsDetailSystem {
  id: number;
  host_name: string;
  status: string;
  lab_name: string;
  room_name: string;
  floor_name: string;
  building_name: string;
  updated_at: string;
}

export interface ReportsDetailFault {
  fault_id: number;
  reported_at: string;
  status: string;
  fault_type: string;
  risk_factor: number;
  system_name: string;
  lab_name: string;
  room_name: string;
  floor_name: string;
  building_name: string;
  reported_by: string;
  description: string;
  resolution_summary: string;
  resolved_at: string;
  resolved_by: string;
}

export interface ReportsDetailResource {
  resource_id: number;
  requested_at: string;
  status: string;
  resource_name: string;
  system_name: string;
  lab_name: string;
  room_name: string;
  floor_name: string;
  building_name: string;
  requested_by: string;
  description: string;
  provision_summary: string;
  provided_at: string;
  provided_by: string;
}

export interface ReportsDetailData {
  generated_at: string;
  systems: ReportsDetailSystem[];
  faults: ReportsDetailFault[];
  resources: ReportsDetailResource[];
}

// ─── User Management ──────────────────────────────────────────────────────────

export interface UserManagementItem {
  id: number;
  username: string;
  email: string;
  role: Role;
  is_active: boolean;
  date_joined: string;
  current_assignments: CurrentAssignment[];
}

export interface UserRoleUpdateRequest {
  role: string;
}

export interface UserActiveToggleRequest {
  is_active: boolean;
}

// ─── Analytics Drilldown ────────────────────────────────────────────────────────

export interface AnalyticsYearData {
  year: number;
  avg_daily_hours: number;
  active_days: number;
  total_hours: number;
}

export interface AnalyticsYearlyResponse {
  item_id: number;
  hostname: string;
  years: AnalyticsYearData[];
}

export interface AnalyticsMonthData {
  month: number;
  month_label: string;
  avg_daily_hours: number;
  active_days: number;
  total_hours: number;
}

export interface AnalyticsMonthlyResponse {
  item_id: number;
  hostname: string;
  year: number;
  months: AnalyticsMonthData[];
}

export interface AnalyticsDayData {
  day: number;
  date: string;
  total_hours: number;
  active: boolean;
  boot_sessions: number;
}

export interface AnalyticsDailyResponse {
  item_id: number;
  hostname: string;
  year: number;
  month: number;
  days: AnalyticsDayData[];
}

export interface AnalyticsIntradayBlock {
  start: number;
  end: number;
  boot_time: number;
}

export interface AnalyticsIntradayResponse {
  item_id: number;
  hostname: string;
  date: string;
  timeline: AnalyticsIntradayBlock[];
}