import axios from 'axios';
import { getCSRFToken } from '@/utils/csrf';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
export const apiBaseURL = configuredApiBase
  ? configuredApiBase.replace(/\/+$/, '')
  : '/api/v1';

const apiClient = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase() ?? '';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(err);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  me: () => apiClient.get('/auth/me/'),
  login: (data: { username: string; password: string }) =>
    apiClient.post('/auth/login/', data),
  logout: () => apiClient.post('/auth/logout/'),
  register: (data: {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => apiClient.post('/auth/register/', data),
  signupRequestOtp: (data: {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => apiClient.post('/auth/signup-otp/', data),
  signupVerifyOtp: (data: { otp: string }) =>
    apiClient.post('/auth/signup-verify/', data),
  forgotPasswordRequest: (data: { email: string }) =>
    apiClient.post('/auth/forgot-password/', data),
  forgotPasswordVerify: (data: { otp: string; new_password: string; confirm_password: string }) =>
    apiClient.post('/auth/forgot-password-verify/', data),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  metrics: (params?: {
    building_id?: number;
    floor_id?: number;
    room_id?: number;
    start_date?: string;
    end_date?: string;
  }) => apiClient.get('/dashboard/metrics/', { params }),
};

export const notificationsApi = {
  list: (params?: { unread?: boolean; page?: number; page_size?: number }) =>
    apiClient.get('/notifications/', { params }),
  update: (id: number, data: { is_read: boolean }) =>
    apiClient.patch(`/notifications/${id}/`, data),
  markAllRead: () => apiClient.post('/notifications/mark-read-all/'),
  clear: (scope: 'all' | 'unread' | 'read' = 'all') =>
    apiClient.delete('/notifications/', { params: { scope } }),
  createAdminMessage: (data: {
    message: string;
    recipient_ids?: number[];
    send_to_all?: boolean;
    target_url?: string;
  }) => apiClient.post('/notifications/', data),
};

// ─── Layout ───────────────────────────────────────────────────────────────────
export const layoutApi = {
  getItems: (params?: { parent_id?: number | null }) =>
    apiClient.get('/layout/items/', { params }),
  getItem: (id: number) => apiClient.get(`/layout/items/${id}/`),
  createItem: (data: Record<string, unknown>) =>
    apiClient.post('/layout/items/', data),
  updateItem: (id: number, data: Record<string, unknown>) =>
    apiClient.patch(`/layout/items/${id}/`, data),
  deleteItem: (id: number) => apiClient.delete(`/layout/items/${id}/`),
  getBreadcrumb: (id: number) => apiClient.get(`/layout/breadcrumb/${id}/`),
  getSystems: () => apiClient.get('/layout/systems/'),
  updateSystemStatus: (systemId: number, status: string) =>
    apiClient.patch(`/layout/systems/${systemId}/`, { status }),
  getItemMonitoring: (itemId: number) =>
    apiClient.get('/monitoring/', { params: { item_id: itemId } }),
  getItemMonitoringHistory: (itemId: number, limit = 72) =>
    apiClient.get('/monitoring/history/', { params: { item_id: itemId, limit } }),
  getItemUptimeMonthly: (itemId: number, months = 6) =>
    apiClient.get('/monitoring/uptime/', { params: { item_id: itemId, months } }),
    
  getAnalyticsYearly: (itemId: number) =>
    apiClient.get('/monitoring/analytics/yearly/', { params: { item_id: itemId } }),
  getAnalyticsMonthly: (itemId: number, year: number) =>
    apiClient.get('/monitoring/analytics/monthly/', { params: { item_id: itemId, year } }),
  getAnalyticsDaily: (itemId: number, year: number, month: number) =>
    apiClient.get('/monitoring/analytics/daily/', { params: { item_id: itemId, year, month } }),
  getAnalyticsIntraday: (itemId: number, date: string) =>
    apiClient.get('/monitoring/analytics/intraday/', { params: { item_id: itemId, date } }),
};

// ─── Faults ───────────────────────────────────────────────────────────────────
export const faultsApi = {
  list: (params?: Record<string, unknown>, signal?: AbortSignal) =>
    apiClient.get('/faults/', { params, signal }),
  create: (data: Record<string, unknown>) => apiClient.post('/faults/', data),
  updateStatus: (id: number, data: Record<string, unknown>) =>
    apiClient.patch(`/faults/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/faults/${id}/`),
};

// ─── Resources ────────────────────────────────────────────────────────────────
export const resourcesApi = {
  list: (params?: Record<string, unknown>, signal?: AbortSignal) =>
    apiClient.get('/resources/', { params, signal }),
  create: (data: Record<string, unknown>) => apiClient.post('/resources/', data),
  updateStatus: (id: number, data: Record<string, unknown>) =>
    apiClient.patch(`/resources/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/resources/${id}/`),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  get: (params?: { building_id?: number; floor_id?: number; lab_id?: number; start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/', { params }),
  details: (params?: { building_id?: number; floor_id?: number; lab_id?: number; room_id?: number; start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/details/', { params }),
  maintenanceSummary: (params?: { period?: 'weekly' | 'monthly'; start?: string; end?: string; user_id?: number; lab_id?: number }) =>
    apiClient.get('/reports/maintenance-summary/', { params }),
  replacementCosts: (params?: { start?: string; end?: string; status?: string }) =>
    apiClient.get('/reports/replacement-costs/', { params }),
  pcStatus: () => apiClient.get('/reports/pc-status/'),
};

// ─── Admin oversight & budgeting ────────────────────────────────────────────────
export const adminApi = {
  staffActivity: (params?: { start?: string; end?: string }) =>
    apiClient.get('/admin/staff-activity/', { params }),
  taskSheet: (params: { user_id: number; start: string; end: string }) =>
    apiClient.get('/admin/task-sheet/', { params }),
  budgetSummary: (params?: { start?: string; end?: string }) =>
    apiClient.get('/admin/budget-summary/', { params }),
};

// ─── Labs ─────────────────────────────────────────────────────────────────────

export const labsApi = {
  list: () => apiClient.get('/layout/labs/'),
};

// ─── Monitoring ───────────────────────────────────────────────────────────────
export const monitoringApi = {
  latest: () => apiClient.get('/monitoring/'),
  getConfig: () => apiClient.get('/monitoring/config/'),
  updateConfig: (data: {
    heartbeat_interval_minutes?: number;
    offline_detection_threshold_minutes?: number;
    max_log_retention_days?: number;
  }) => apiClient.patch('/monitoring/config/', data),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: { role?: string }) => apiClient.get('/users/', { params }),
  create: (data: { username: string; email: string; password: string; role: string }) =>
    apiClient.post('/users/create/', data),
  update: (id: number, data: Record<string, unknown>) =>
    apiClient.patch(`/users/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/users/${id}/`),
  privilegesStats: () => apiClient.get('/privileges/stats/'),
};

// ─── Privileges ───────────────────────────────────────────────────────────────
export const privilegesApi = {
  getAssignments: (labId?: number) =>
    apiClient.get('/privileges/assignments/', labId ? { params: { lab_id: labId } } : undefined),
  createAssignment: (data: {
    lab: number;
    user: number;
    role_type: 'incharge' | 'assistant';
    start_date?: string | null;
    end_date?: string | null;
  }) => apiClient.post('/privileges/assignments/', data),
  deleteAssignment: (id: number) => apiClient.delete(`/privileges/assignments/${id}/`),
  getConfig: () => apiClient.get('/privileges/config/'),
  updateConfig: (data: { max_labs_per_incharge?: number; max_labs_per_assistant?: number; max_incharges_per_lab?: number; max_assistants_per_lab?: number }) =>
    apiClient.patch('/privileges/config/', data),
};

// ─── Profile ──────────────────────────────────────────────────────────────────
export const profileApi = {
  update: (data: { action: 'change_username' | 'change_email' | 'change_password'; new_value: string; current_password: string }) =>
    apiClient.post('/profile/update/', data),
  deleteAccount: () => apiClient.delete('/profile/delete/'),
};

export default apiClient;
