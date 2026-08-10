import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/* ── Types ──────────────────────────────────────────────────── */

/**
 * Auth store per ARCHITECTURE §6:
 * `user`, `isAuthenticated`, `isLoading`, `error`,
 * `login(email, password)`, `signup(name, email, password)`, `logout()`,
 * with sessionStorage persistence of the session.
 *
 * Legacy setters (`setSession`, `setUser`, `setLoading`) and `signOut`
 * are retained for existing consumers (TopBar sign-out, useCurrentUser
 * auth-state sync).
 */
export interface AuthState {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;

  /** Legacy alias for `logout` — kept for existing callers. */
  signOut: () => void;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
}

/* ── Derived Selectors ────────────────────────────────────────── */
/** Reads the persisted authenticated flag. */
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);

/* ── Auth Store ──────────────────────────────────────────────── */

const resetAuthState = (): Pick<AuthState, 'session' | 'user' | 'isAuthenticated' | 'isLoading' | 'error'> => ({
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...resetAuthState(),

      setSession: (session) => set({ session, isAuthenticated: !!session }),
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (isLoading) => set({ isLoading }),
      clearError: () => set({ error: null }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const supabase = await createClient();
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          if (!data.user) {
            throw new Error('Invalid credentials. Please try again.');
          }
          set({
            user: data.user,
            session: data.session,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (e) {
          const message =
            e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.';
          set({ isLoading: false, error: message });
          throw e instanceof Error ? e : new Error(message);
        }
      },

      signup: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const supabase = await createClient();
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } },
          });
          if (error) throw error;
          if (!data.user) {
            throw new Error('Failed to create account. Please try again.');
          }
          set({
            user: data.user,
            session: data.session ?? null,
            isAuthenticated: !!data.session,
            isLoading: false,
            error: null,
          });
        } catch (e) {
          const message =
            e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.';
          set({ isLoading: false, error: message });
          throw e instanceof Error ? e : new Error(message);
        }
      },

      logout: () => set(resetAuthState()),
      signOut: () => set(resetAuthState()),
    }),
    {
      name: 'nexuscrm-auth',
      // ARCHITECTURE §6: session persists to sessionStorage (per-tab,
      // cleared when the tab closes).
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        session: state.session,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
