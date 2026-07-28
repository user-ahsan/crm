import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

/* ── Types ──────────────────────────────────────────────────── */
export interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

/* ── Derived Selectors ────────────────────────────────────────── */
/** Derived from `session` — no stale writable state needed. */
export const useIsAuthenticated = () => useAuthStore((state) => !!state.session);

/* ── Auth Store ──────────────────────────────────────────────── */
export const useAuthStore = create<AuthState>()(
  (set) => ({
    session: null,
    user: null,
    isLoading: false,

    setSession: (session) => set({ session }),
    setUser: (user) => set({ user }),
    setLoading: (isLoading) => set({ isLoading }),
    signOut: () =>
      set({ session: null, user: null, isLoading: false }),
  }),
);
