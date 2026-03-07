import axios from 'axios';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBaseURL = configuredApiBase
  ? configuredApiBase.replace(/\/+$/, '')
  : '/api/v1';

// Axios instance — points at the Vite dev-server proxy which forwards to Django
const api = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true, // include session cookie
  headers: { 'Content-Type': 'application/json' },
});

// Read the csrftoken cookie set by Django's CsrfViewMiddleware
function getCsrfToken(): string {
  return (
    document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1] ?? ''
  );
}

// Attach CSRF token to every mutating request (synchronous — no extra round-trip)
api.interceptors.request.use((config) => {
  const safe = ['get', 'head', 'options'];
  if (config.method && !safe.includes(config.method.toLowerCase())) {
    config.headers['X-CSRFToken'] = getCsrfToken();
  }
  return config;
});

// On 401 clear auth state (handled in the auth store via an event).
// 403 is NOT treated as a session expiry — it means the user is authenticated
// but lacks permission for that resource, so we leave the session alone.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(err);
  }
);

export default api;
