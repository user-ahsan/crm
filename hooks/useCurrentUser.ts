'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AuthChangeEvent, User } from '@supabase/supabase-js';
import type { CurrentUser } from '@/types/account.types';
import { getCachedUser, clearCachedUser } from '@/lib/cached-user';
import { useAuthStore } from '@/store/auth';

/**
 * Derives initials from a full name (max 2 characters).
 * "Alice Johnson" → "AJ", "Bob" → "B", "" → "?"
 */
function deriveInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 1).toUpperCase() || '?';
}

function mapUser(user: User): CurrentUser {
  const meta = user.user_metadata ?? {};
  const fullName: string = typeof meta.full_name === 'string'
    ? meta.full_name
    : user.email ?? 'Unknown';
  return {
    id: user.id,
    email: user.email ?? '',
    fullName,
    initials: deriveInitials(fullName),
    avatarUrl: meta.avatar_url ?? null,
  };
}

/**
 * Returns the currently authenticated user from Supabase Auth.
 *
 * Reads the persisted user from `useAuthStore` (ARCHITECTURE §6 / HOOKS.md)
 * and refreshes it against Supabase via the shared in-memory cache, so
 * multiple consumers (useCurrentUser, useTeamData, etc.) make only ONE
 * API call per page load. Store `user`/`session` are kept in sync with
 * the validated result and on `SIGNED_IN` / `SIGNED_OUT` / `TOKEN_REFRESHED`
 * events, so the store's `isAuthenticated` matches the real session.
 */
export function useCurrentUser() {
  const storeUser = useAuthStore((s) => s.user);
  const setStoreSession = useAuthStore((s) => s.setSession);
  const setStoreUser = useAuthStore((s) => s.setUser);

  // Seed from the persisted store user so hydration never flashes a
  // signed-out UI; the refresh below re-validates against Supabase.
  const [user, setUser] = useState<CurrentUser | null>(() =>
    storeUser ? mapUser(storeUser) : null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabaseUser = await getCachedUser();
      if (supabaseUser) {
        setUser(mapUser(supabaseUser));
        setStoreUser(supabaseUser);
      } else {
        // Genuinely signed out — mirror that on the store.
        setUser(null);
        setStoreUser(null);
        setStoreSession(null);
      }
    } catch (e) {
      // Transient failure — keep any previously known user; surface the
      // error instead of flashing a signed-out UI.
      setError(e instanceof Error ? e.message : 'Failed to fetch user');
    } finally {
      setLoading(false);
    }
  }, [setStoreSession, setStoreUser]);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    async function init() {
      // Skip the API call when there is neither an sb- session cookie
      // nor a persisted store user (clearly signed out).
      const hasSessionCookie =
        typeof document !== 'undefined' && document.cookie.includes('sb-');
      if (!hasSessionCookie && !storeUser) {
        setLoading(false);
        if (cancelled) return;
        return;
      }
      await refresh();
      if (cancelled) return;

      const supabase = await createClient();
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (event: AuthChangeEvent, session) => {
          if (event === 'SIGNED_IN') {
            clearCachedUser();
            setStoreSession(session);
            setStoreUser(session?.user ?? null);
            if (session?.user) setUser(mapUser(session.user));
          } else if (event === 'SIGNED_OUT') {
            clearCachedUser();
            setStoreSession(null);
            setStoreUser(null);
            setUser(null);
          } else if (event === 'TOKEN_REFRESHED') {
            setStoreSession(session);
            if (session?.user) {
              setStoreUser(session.user);
              setUser(mapUser(session.user));
            }
          }
        }
      );
      subscription = sub;
    }

    init();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [refresh, storeUser, setStoreSession, setStoreUser]);

  return { user, isAuthenticated: !!user, loading, error, refresh };
}
