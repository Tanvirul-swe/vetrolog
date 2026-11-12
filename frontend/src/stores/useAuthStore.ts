import { create } from 'zustand';
import * as AppBindings from '../../wailsjs/go/app/App';
import { isWailsApp, apiFetch } from '@/services/apiBridge';
import { telemetry } from '@/features/telemetry/telemetryService';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
  givenName?: string;
  familyName?: string;
  provider: string;
  loggedInAt?: string | number | Date;
}

export interface AuthState {
  isAuthenticated: boolean;
  isDemoMode: boolean;
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  error: string | null;

  checkAuthStatus: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithDemo: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isDemoMode: true,
  user: null,
  isLoading: false,
  isAuthenticating: false,
  error: null,

  clearError: () => set({ error: null }),

  checkAuthStatus: async () => {
    try {
      if (isWailsApp() && typeof AppBindings.GetAuthStatus === 'function') {
        const status = await AppBindings.GetAuthStatus();
        set({
          isAuthenticated: Boolean(status.isAuthenticated),
          isDemoMode: Boolean(status.isDemoMode),
          user: (status.user as UserProfile) || null,
        });
        return;
      }

      const res = await apiFetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        set({
          isAuthenticated: Boolean(data.isAuthenticated),
          isDemoMode: Boolean(data.isDemoMode),
          user: (data.user as UserProfile) || null,
        });
      }
    } catch (err: any) {
      console.warn('[Auth] Failed to check status:', err);
    }
  },

  loginWithGoogle: async () => {
    set({ isAuthenticating: true, error: null });
    let pollTimer: any = null;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      set({ isAuthenticating: false });
    };

    try {
      if (isWailsApp() && typeof AppBindings.StartGoogleLogin === 'function') {
        const authUrl = await AppBindings.StartGoogleLogin();
        if (!authUrl) {
          throw new Error('Google OAuth is not configured or could not start.');
        }

        // Poll for completion while external browser handles Google authentication
        let attempts = 0;
        pollTimer = setInterval(async () => {
          attempts++;
          await get().checkAuthStatus();
          if (get().isAuthenticated || attempts > 60) {
            stopPolling();
          }
        }, 1500);

        return;
      }

      // Web / Browser mode
      const res = await apiFetch('/api/auth/google/login');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to initialize Google login');
      }

      const data = await res.json();
      if (data.isDemoMode && !data.authUrl) {
        // Fallback to demo login if Google credentials not configured
        await get().loginWithDemo();
        stopPolling();
        return;
      }

      if (data.authUrl) {
        window.open(data.authUrl, '_blank', 'noopener,noreferrer');
        let attempts = 0;
        pollTimer = setInterval(async () => {
          attempts++;
          await get().checkAuthStatus();
          if (get().isAuthenticated || attempts > 60) {
            stopPolling();
          }
        }, 1500);
      }
    } catch (err: any) {
      stopPolling();
      set({ error: err.message || 'Failed to sign in with Google' });
    }
  },

  loginWithDemo: async () => {
    set({ isLoading: true, error: null });
    try {
      if (isWailsApp() && typeof AppBindings.LoginWithDemo === 'function') {
        const status = await AppBindings.LoginWithDemo();
        set({
          isAuthenticated: Boolean(status.isAuthenticated),
          isDemoMode: Boolean(status.isDemoMode),
          user: (status.user as UserProfile) || null,
          isLoading: false,
        });
        telemetry.trackFeature('demo_login');
        return;
      }

      const res = await apiFetch('/api/auth/demo-login', {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Demo login failed');
      }
      const data = await res.json();
      set({
        isAuthenticated: Boolean(data.isAuthenticated),
        isDemoMode: Boolean(data.isDemoMode),
        user: (data.user as UserProfile) || null,
        isLoading: false,
      });
      telemetry.trackFeature('demo_login');
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Demo login failed',
      });
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      if (isWailsApp() && typeof AppBindings.SignOut === 'function') {
        await AppBindings.SignOut();
      } else {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      }
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
      telemetry.trackFeature('sign_out');
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Logout failed',
      });
    }
  },
}));

// Auto-check authentication on app initialization and when the window gains focus
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useAuthStore.getState().checkAuthStatus();
  }, 100);

  window.addEventListener('focus', () => {
    useAuthStore.getState().checkAuthStatus();
  });
}

