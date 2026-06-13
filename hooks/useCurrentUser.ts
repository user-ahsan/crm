'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        const supabase = await createClient();
        const { data, error: authError } = await supabase.auth.getUser();

        if (cancelled) return;

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
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to fetch user');
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading, error };
}
