export interface User {
  id: number;
  username: string;
  email: string;
  role: 'Administrator' | 'Lab Assistant' | 'Lab In-Charge' | 'No Roles';
  is_active: boolean;
  date_joined: string;
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

export interface SimpleSystem {
  id: number;
  host_name: string;
  unique_code: string;
  layout_item_id: number | null;
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

export interface FaultReport {
  id: number;
  system: number;
  system_hostname: string;
  reported_by: number;
  reported_by_username: string;
  fault_type: 'hardware' | 'software' | 'network' | 'peripheral' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'reported' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_notes: string;
  assigned_to: number | null;
  assigned_to_username: string | null;
}

export interface FaultCreateRequest {
  system: number;
  fault_type: string;
  severity: string;
  description: string;
}

export interface FaultUpdateRequest {
  status?: string;
  assigned_to?: number | null;
  resolution_notes?: string;
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

export interface ResourceCreateRequest {
  name: string;
  resource_type: string;
  lab?: number | null;
  description?: string;
}

export interface ResourceUpdateRequest {
  name?: string;
  resource_type?: string;
  status?: string;
  lab?: number | null;
  description?: string;
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

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
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
  start_date?: string | null;
  end_date?: string | null;
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

export interface UserManagementItem {
  id: number;
  username: string;
  email: string;
  role: 'Administrator' | 'Lab Assistant' | 'Lab In-Charge' | 'No Roles';
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

// ─── Privileges Configuration ─────────────────────────────────────────────────
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