import { create } from 'zustand';
import type { CapabilitiesResponse, FeatureFlags, User } from '@/types';
import { authApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  tenant: { slug: string | null; name: string | null } | null;
  features: FeatureFlags;
  permissions: string[];
  isLoading: boolean;
  isInitialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshCapabilities: () => Promise<void>;
  isFeatureEnabled: (featureCode: string) => boolean;
  hasPermission: (permissionCode: string) => boolean;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  (set, get) => ({
    user: null,
    tenant: null,
    features: {},
    permissions: [],
    isLoading: false,
    isInitialized: false,

    refreshCapabilities: async () => {
      try {
        const { data } = await authApi.capabilities();
        const payload = data as CapabilitiesResponse;
        set({
          tenant: payload.tenant ?? null,
          features: payload.features ?? {},
          permissions: payload.permissions ?? [],
        });
      } catch {
        // Keep defaults; backend remains source of truth for enforcement.
        set({ tenant: null, features: {}, permissions: [] });
      }
    },

    isFeatureEnabled: (featureCode: string) => {
      const features = get().features;
      // Backward-compatible fallback: if no feature map is loaded, do not hide UI.
      if (!features || Object.keys(features).length === 0) return true;
      return Boolean(features[featureCode]);
    },

    hasPermission: (permissionCode: string) => {
      const user = get().user;
      if (!user) return false;
      if (user.is_superuser) return true;
      const permissions = get().permissions;
      // Backward-compatible fallback while migrating older tenants.
      if (!permissions || permissions.length === 0) {
        if (permissionCode === 'users.manage') {
          return user.role === 'Administrator';
        }
        return false;
      }
      return permissions.includes(permissionCode);
    },

    initialize: async () => {
      if (get().isInitialized) return;
      try {
        const { data } = await authApi.me();
        set({ user: data.user, isInitialized: true });
        await get().refreshCapabilities();
      } catch {
        set({ user: null, tenant: null, features: {}, permissions: [], isInitialized: true });
      }
    },

    login: async (username, password) => {
      set({ isLoading: true });
      try {
        const { data } = await authApi.login({ username, password });
        set({ user: data.user, isLoading: false });
        await get().refreshCapabilities();
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    register: async (username, email, password, confirmPassword) => {
      set({ isLoading: true });
      try {
        const { data } = await authApi.register({ username, email, password, confirm_password: confirmPassword });
        set({ user: data.user, isInitialized: true, isLoading: false });
        await get().refreshCapabilities();
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    logout: async () => {
      try {
        await authApi.logout();
      } finally {
        set({ user: null, tenant: null, features: {}, permissions: [], isInitialized: true });
      }
    },

    updateUser: (user: User) => {
      set({ user });
    },
  })
);

// Respond to 401/403 from the API interceptor
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.setState({ user: null, tenant: null, features: {}, permissions: [], isInitialized: true });
  });
}
