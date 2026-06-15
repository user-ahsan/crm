'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import type { CurrentUser } from '@/types/account.types';
import { getCachedUser, clearCachedUser } from '@/lib/cached-user';

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

function mapUser(user: import('@supabase/supabase-js').User): CurrentUser {
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
 * Uses a shared in-memory cache so multiple consumers (useCurrentUser,
 * useTeamData, etc.) make only ONE API call per page load.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabaseUser = await getCachedUser();
      setUser(supabaseUser ? mapUser(supabaseUser) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    async function init() {
      await refresh();
      if (cancelled) return;

      const supabase = await createClient();
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
        if (event === 'SIGNED_IN') {
          clearCachedUser();
          refresh();
        } else if (event === 'SIGNED_OUT') {
          clearCachedUser();
          setUser(null);
        }
      });
      subscription = sub;
    }

    init();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [refresh]);

  return { user, loading, error, refresh };
}
