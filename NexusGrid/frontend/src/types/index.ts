// ─── User & Auth ──────────────────────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'Administrator' | 'Lab Incharge' | 'Lab Assistant' | 'Students' | 'No Roles';
  is_staff: boolean;
  is_superuser: boolean;
  assigned_labs?: string[];
  date_joined: string;
  last_login: string | null;
}

// ─── Layout ─────────────────────────────────────────────────────────────────
export type ItemType =
  | 'building'
  | 'floor'
  | 'room'
  | 'computer'
  | 'server'
  | 'network_switch'
  | 'router'
  | 'printer'
  | 'ups'
  | 'rack';

export type SystemStatus = 'active' | 'inactive' | 'non-functional';

export interface LayoutItem {
  id: number;
  name: string;
  item_type: ItemType;
  parent: number | null;
  parent_name: string | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
  status: SystemStatus | null;
  quick_info: Record<string, unknown> | null;
  /** 'online' if the item's hostname has monitoring data, null otherwise */
  monitoring_status: 'online' | null;
  /** fault/resource alert state for device nodes */
  alert_status: 'fault_active' | 'resource_pending' | 'fault_resolved' | 'resource_done' | null;
}

export interface System {
  id: number;
  layout_item: number;
  layout_item_name: string;
  layout_item_type: ItemType;
  lab: number | null;
  lab_name: string | null;
  host_name: string;
  status: SystemStatus;
  updated_at: string;
  updated_by_username: string | null;
}

export interface Lab {
  id: number;
  lab_name: string;
  lab_code: string | null;
  location: string | null;
  capacity: number | null;
  dimension: string | null;
  quick_info: Record<string, unknown>;
  instructors: User[];
  assistants: User[];
  layout_item_id: number;
  layout_item_name: string;
  floor_id: number | null;
  parent_name: string | null;
  building_name: string | null;
  systems_count: number;
  current_incharge: CurrentAssignment | null;
  current_assistant: CurrentAssignment | null;
  current_incharges: CurrentAssignment[];
  current_assistants: CurrentAssignment[];
}

export interface BreadcrumbItem {
  id: number;
  name: string;
  item_type: ItemType;
}

// ─── Faults ─────────────────────────────────────────────────────────────────
export type FaultType = 'Hardware' | 'Software' | 'Network';
export type FaultStatus = 'unaddressed' | 'in-progress' | 'scheduled' | 'resolved' | 'ignored';

export interface Resolved {
  resolution_summary: string;
  resolved_by_username: string;
  resolved_at: string;
}

export interface FaultReport {
  fault_id: number;
  system_name: number;
  system_host_name: string;
  lab_name: string | null;
  reported_by: number;
  reported_by_username: string;
  fault_type: FaultType;
  risk_factor: 1 | 2 | 3 | 4 | 5;
  description: string;
  status: FaultStatus;
  reported_at: string;
  resolved: Resolved | null;
}

// ─── Resources ───────────────────────────────────────────────────────────────
export type ResourceStatus = 'Pending' | 'Fulfilled' | 'Denied';

export interface Provided {
  provision_summary: string;
  provided_by_username: string;
  provided_at: string;
}

export interface ResourceRequest {
  resource_id: number;
  system_name: number;
  system_host_name: string;
  lab_name: string | null;
  requested_by: number;
  requested_by_username: string;
  resource_name: string;
  description: string;
  quantity: number;
  cost: number | null;
  line_total: number | null;
  status: ResourceStatus;
  requested_at: string;
  provided: Provided | null;
}

// ─── Monitoring ──────────────────────────────────────────────────────────────
export interface GpuStat {
  gpu_id: number;
  gpu_name: string;
  gpu_load_percent: number;
  gpu_memory_used: number;
  gpu_memory_total: number;
  gpu_memory_percent: number;
  gpu_temperature: number;
}

export interface SystemInfo {
  id?: number;
  hostname: string;
  ip_address: string | null;
  // OS
  system: string | null;
  version: string | null;
  release: string | null;
  machine: string | null;
  processor: string | null;
  architecture: string | null;
  // CPU
  cpu_physical_cores: number | null;
  cpu_total_cores: number | null;
  cpu_max_freq: number | null;
  cpu_min_freq: number | null;
  cpu_current_freq: number | null;
  cpu_usage: number | null;
  // Memory
  memory_total: number | null;
  memory_available: number | null;
  memory_used: number | null;
  memory_usage_percent: number | null;
  // Disk
  disk_total: number | null;
  disk_used: number | null;
  disk_free: number | null;
  disk_usage_percent: number | null;
  // Network
  bytes_sent: number | null;
  bytes_received: number | null;
  // Users
  users_count: number | null;
  logged_in_users: string | null;
  // GPU
  gpu_available?: boolean | null;
  gpu_stats?: GpuStat[] | null;
  // Uptime
  boot_time?: number | null;
  uptime_seconds?: number | null;
  today_uptime_seconds?: number | null;
  today_uptime_formatted?: string | null;
  today_date?: string | null;
  // Timestamp
  timestamp: string;
  // Legacy aliases kept for MonitoringPage compat
  os_name?: string | null;
  os_version?: string | null;
  ram_usage?: number | null;
  disk_usage?: number | null;
}

export interface MonitoringHistoryResponse {
  item_id: number;
  hostname: string;
  history: SystemInfo[];
}

// ─── Uptime ─────────────────────────────────────────────────────────────────
export interface UptimeDayDetail {
  date: string;
  uptime_hours: number;
}

export interface UptimeMonthData {
  month: string;
  month_label: string;
  avg_daily_hours: number;
  total_hours: number;
  active_days: number;
  days: UptimeDayDetail[];
}

export interface UptimeMonthlyResponse {
  item_id: number;
  hostname: string;
  months: UptimeMonthData[];
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface DashboardMetrics {
  systems: {
    total: number;
    functional: number;
    critical: number;
    active: number;
    functional_pct: number;
    critical_pct: number;
    active_pct: number;
    utilization_pct: number;
  };
  faults: { open: number; total: number };
  resources: { pending: number; fulfilled?: number; total: number };
  today?: {
    faults_reported: number;
    faults_resolved: number;
    resources_requested: number;
    resources_fulfilled: number;
  };
  labs_total: number;
  fault_trend: { month: string; count: number }[];
  resource_trend: { month: string; count: number }[];
  fault_by_type: Record<string, number>;
  fault_by_status: Record<string, number>;
  recent_activity: ActivityItem[];
}

export interface DashboardFilterParams {
  building_id?: number;
  floor_id?: number;
  room_id?: number;
  start_date?: string;
  end_date?: string;
}

export interface ActivityItem {
  type: 'fault' | 'resource';
  id: number;
  title: string;
  subtitle: string;
  status: string;
  assignee?: string | null;
  time: string;
  user: string;
}

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
  target_url: string;
  is_read: boolean;
  created_at: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: T[];
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export interface ReportsSummary {
  total_systems: number;
  active_systems: number;
  inactive_systems: number;
  non_functional_systems: number;
  total_faults: number;
  open_faults: number;
  total_resources: number;
  pending_resources: number;
}

export interface ReportsData {
  fault_by_status: Record<string, number>;
  fault_by_type: Record<string, number>;
  resource_by_status: Record<string, number>;
  system_by_status: Record<string, number>;
  fault_monthly: { month: string; type: string; count: number }[];
  resource_monthly: { month: string; count: number }[];
  summary: ReportsSummary;
}

export interface ReportDetailSystem {
  id: number;
  host_name: string;
  status: string;
  lab_name: string;
  room_name: string;
  floor_name: string;
  building_name: string;
  updated_at: string;
}

export interface ReportDetailFault {
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

export interface ReportDetailResource {
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
  systems: ReportDetailSystem[];
  faults: ReportDetailFault[];
  resources: ReportDetailResource[];
}

// ─── Privileges ──────────────────────────────────────────────────────────────
export interface PrivilegesStats {
  total_users: number;
  unassigned_users: number;
  total_labs: number;
  labs_without_instructor: number;
  labs_without_assistant: number;
}

export interface SimpleSystem {
  id: number;
  unique_code: string;
  layout_item_id: number | null;
  host_name: string;
  lab_id: number | null;
  lab_name: string | null;
  status: SystemStatus;
}

// ─── Lab Assignment & Privileges ──────────────────────────────────────────────

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

export interface CurrentAssignment {
  assignment_id: number;
  user_id: number;
  username: string;
  start_date: string | null;
  end_date: string | null;
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
