import { create } from 'zustand';
import type { User } from '@/types';
import { authApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  updateUser: (user: User) => void;
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

    register: async (username, email, password, confirmPassword) => {
      set({ isLoading: true });
      try {
        const { data } = await authApi.register({ username, email, password, confirm_password: confirmPassword });
        set({ user: data.user, isInitialized: true, isLoading: false });
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    logout: async () => {
      try {
        await authApi.logout();
      } finally {
        set({ user: null, isInitialized: true });
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
    useAuthStore.setState({ user: null, isInitialized: true });
  });
}
