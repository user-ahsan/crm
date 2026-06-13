'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import type { CurrentUser } from '@/types/account.types';
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

/**
 * Returns the currently authenticated user from Supabase Auth.
 *
 * - Reads `user.user_metadata.full_name` (set during signup).
 * - Derives initials automatically.
 * - Returns `null` while loading.
 * - Returns `CurrentUser` once available.
 * - Never returns mock data.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = await createClient();
      const { data, error: authError } = await supabase.auth.getUser();

      if (authError) {
        setError(authError.message);
        setUser(null);
        return;
      }

      if (!data.user) {
        setUser(null);
        return;
      }

      const meta = data.user.user_metadata ?? {};
      const fullName: string = typeof meta.full_name === 'string'
        ? meta.full_name
        : data.user.email ?? 'Unknown';
      const initials = deriveInitials(fullName);

      setUser({
        id: data.user.id,
        email: data.user.email ?? '',
        fullName,
        initials,
        avatarUrl: meta.avatar_url ?? null,
      });
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
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          refresh();
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
