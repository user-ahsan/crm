'use client';

import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

/**
 * ─── Cached Auth User ──────────────────────────────────────────────
 *
 * Cache the `supabase.auth.getUser()` result in a module-level variable
 * so every consumer (useCurrentUser, useTeamData, etc.) shares the same
 * API call. Only the first caller triggers the Supabase API; subsequent
 * callers in the same page load get the cached result instantly.
 *
 * The cache is invalidated when:
 *   - The user explicitly signs out (signOut clears it)
 *   - The page is reloaded/closed (module scope resets)
 * ───────────────────────────────────────────────────────────────────
 */

let _cachedUser: User | null = null;
let _cachedUserLoaded = false;
let _fetchPromise: Promise<User | null> | null = null;

/**
 * Returns the current Supabase user, fetching from cache if available.
 * Multiple concurrent callers share the same in-flight promise.
 */
export async function getCachedUser(): Promise<User | null> {
  // Already cached
  if (_cachedUserLoaded) return _cachedUser;

  // Fetch in progress — join the existing request
  if (_fetchPromise) return _fetchPromise;

  // First caller — start the fetch
  _fetchPromise = (async (): Promise<User | null> => {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      _cachedUser = data?.user ?? null;
      _cachedUserLoaded = true;
      return _cachedUser;
    } catch (e) {
      // Transient failure — do NOT cache it as "signed out". Leave
      // `_cachedUserLoaded` false so the next caller retries, and rethrow
      // so callers can surface the error instead of treating the failure
      // as a genuine signed-out state (a network blip must not log the
      // user out or permanently null the cache).
      throw e;
    } finally {
      _fetchPromise = null;
    }
  })();

  return _fetchPromise;
}

/**
 * Clears the cached user. Call after sign out to ensure the next caller
 * fetches fresh data.
 */
export function clearCachedUser(): void {
  _cachedUser = null;
  _cachedUserLoaded = false;
  _fetchPromise = null;
}
