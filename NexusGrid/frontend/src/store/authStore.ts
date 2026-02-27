import { create } from 'zustand';
import type { User } from '@/types';
import { authApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  (set, get) => ({
    user: null,
    isLoading: false,
    isInitialized: false,

    initialize: async () => {
      if (get().isInitialized) return;
      try {
        const { data } = await authApi.me();
        set({ user: data.user, isInitialized: true });
      } catch {
        set({ user: null, isInitialized: true });
      }
    },

    login: async (username, password) => {
      set({ isLoading: true });
      try {
        const { data } = await authApi.login({ username, password });
        set({ user: data.user, isLoading: false });
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    logout: async () => {
      try {
        await authApi.logout();
      } finally {
        set({ user: null, isInitialized: false });
      }
    },
  })
);

// Respond to 401/403 from the API interceptor
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.setState({ user: null, isInitialized: false });
  });
}
