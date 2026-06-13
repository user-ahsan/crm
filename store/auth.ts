import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

/* ── Types ──────────────────────────────────────────────────── */
export interface AuthState {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

/* ── Auth Store ──────────────────────────────────────────────── */
export const useAuthStore = create<AuthState>()(
  (set) => ({
    session: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,

    setSession: (session) => set({ session, isAuthenticated: !!session }),
    setUser: (user) => set({ user }),
    setLoading: (isLoading) => set({ isLoading }),
    signOut: () =>
      set({ session: null, user: null, isAuthenticated: false }),
  }),
);
