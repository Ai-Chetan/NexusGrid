import axios from 'axios';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBaseURL = configuredApiBase
  ? configuredApiBase.replace(/\/+$/, '')
  : '/api/v1';

function getCsrfToken(): string {
  return (
    document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1] ?? ''
  );
}

const api = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const method = config.method?.toUpperCase() ?? '';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    config.headers['X-CSRFToken'] = getCsrfToken();
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(err);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  me: () => api.get('/auth/me/'),
  capabilities: () => api.get('/auth/capabilities/'),
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login/', data),
  logout: () => api.post('/auth/logout/'),
  register: (data: {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => api.post('/auth/register/', data),
  signupRequestOtp: (data: {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => api.post('/auth/signup-otp/', data),
  signupVerifyOtp: (data: { otp: string }) =>
    api.post('/auth/signup-verify/', data),
  forgotPasswordRequest: (data: { email: string }) =>
    api.post('/auth/forgot-password/', data),
  forgotPasswordVerify: (data: { otp: string; new_password: string; confirm_password: string }) =>
    api.post('/auth/forgot-password-verify/', data),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  metrics: (params?: {
    building_id?: number;
    floor_id?: number;
    room_id?: number;
    start_date?: string;
    end_date?: string;
  }) => api.get('/dashboard/metrics/', { params }),
};

export const notificationsApi = {
  list: (params?: { unread?: boolean; page?: number; page_size?: number }) =>
    api.get('/notifications/', { params }),
  update: (id: number, data: { is_read: boolean }) =>
    api.patch(`/notifications/${id}/`, data),
  markAllRead: () => api.post('/notifications/mark-read-all/'),
  clear: (scope: 'all' | 'unread' | 'read' = 'all') =>
    api.delete('/notifications/', { params: { scope } }),
  createAdminMessage: (data: {
    message: string;
    recipient_ids?: number[];
    send_to_all?: boolean;
    target_url?: string;
  }) => api.post('/notifications/', data),
};

// ─── Layout ───────────────────────────────────────────────────────────────────
export const layoutApi = {
  getItems: (params?: { parent_id?: number | null }) =>
    api.get('/layout/items/', { params }),
  getItem: (id: number) => api.get(`/layout/items/${id}/`),
  createItem: (data: Record<string, unknown>) =>
    api.post('/layout/items/', data),
  updateItem: (id: number, data: Record<string, unknown>) =>
    api.patch(`/layout/items/${id}/`, data),
  deleteItem: (id: number) => api.delete(`/layout/items/${id}/`),
  getBreadcrumb: (id: number) => api.get(`/layout/breadcrumb/${id}/`),
  getSystems: () => api.get('/layout/systems/'),
  updateSystemStatus: (systemId: number, status: string) =>
    api.patch(`/layout/systems/${systemId}/`, { status }),
  getItemMonitoring: (itemId: number) =>
    api.get('/monitoring/', { params: { item_id: itemId } }),
  getItemMonitoringHistory: (itemId: number, limit = 72) =>
    api.get('/monitoring/history/', { params: { item_id: itemId, limit } }),
};

// ─── Faults ───────────────────────────────────────────────────────────────────
export const faultsApi = {
  list: (params?: Record<string, unknown>, signal?: AbortSignal) =>
    api.get('/faults/', { params, signal }),
  create: (data: Record<string, unknown>) => api.post('/faults/', data),
  updateStatus: (id: number, data: Record<string, unknown>) =>
    api.patch(`/faults/${id}/`, data),
};

// ─── Resources ────────────────────────────────────────────────────────────────
export const resourcesApi = {
  list: (params?: Record<string, unknown>, signal?: AbortSignal) =>
    api.get('/resources/', { params, signal }),
  create: (data: Record<string, unknown>) => api.post('/resources/', data),
  updateStatus: (id: number, data: Record<string, unknown>) =>
    api.patch(`/resources/${id}/`, data),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  get: (params?: { building_id?: number; floor_id?: number; lab_id?: number }) =>
    api.get('/reports/', { params }),
};

// ─── Labs ─────────────────────────────────────────────────────────────────────
export const labsApi = {
  list: () => api.get('/layout/labs/'),
};

// ─── Monitoring ───────────────────────────────────────────────────────────────
export const monitoringApi = {
  latest: () => api.get('/monitoring/'),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: { role?: string }) => api.get('/users/', { params }),
  update: (id: number, data: Record<string, unknown>) =>
    api.patch(`/users/${id}/`, data),
  privilegesStats: () => api.get('/privileges/stats/'),
};

// ─── Privileges ───────────────────────────────────────────────────────────────
export const privilegesApi = {
  getAssignments: (labId?: number) =>
    api.get('/privileges/assignments/', labId ? { params: { lab_id: labId } } : undefined),
  createAssignment: (data: {
    lab: number;
    user: number;
    role_type: 'incharge' | 'assistant';
    start_date?: string | null;
    end_date?: string | null;
  }) => api.post('/privileges/assignments/', data),
  deleteAssignment: (id: number) => api.delete(`/privileges/assignments/${id}/`),
  getConfig: () => api.get('/privileges/config/'),
  updateConfig: (data: { max_labs_per_incharge?: number; max_labs_per_assistant?: number }) =>
    api.patch('/privileges/config/', data),
};

// ─── Profile ──────────────────────────────────────────────────────────────────
export const profileApi = {
  requestOtp: (data: { action: 'change_username' | 'change_email' | 'change_password'; new_value: string }) =>
    api.post('/profile/request-otp/', data),
  verifyOtp: (data: { otp: string }) =>
    api.post('/profile/verify-otp/', data),  deleteAccount: () =>
    api.delete('/profile/delete/'),};

export default api;
