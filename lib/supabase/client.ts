/**
 * ─── Supabase Client ────────────────────────────────────────────────────
 *
 * Provides a singleton Supabase browser client using @supabase/ssr for
 * cookie-based session management. All services should use this shared
 * instance rather than creating their own.
 *
 * Environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL  — Your Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — Your Supabase anonymous API key
 * ───────────────────────────────────────────────────────────────────────
 */

import { createBrowserClient } from '@supabase/ssr';

// ── Singleton instance ─────────────────────────────────────────────────

let _client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Returns the shared Supabase browser client (synchronous singleton).
 * Creates the client once on first call and reuses it thereafter.
 * Throws if required environment variables are missing.
 */
export function getSupabaseClient() {
  if (!_client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables. ' +
        'Ensure they are set in your .env file (see .env.example for the required format).'
      );
    }

    _client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}

// ── Backward Compatibility ─────────────────────────────────────────────

/** @deprecated Use getSupabaseClient() instead — synchronous singleton. */
export async function createClient() {
  return getSupabaseClient();
}

/** @deprecated Use getSupabaseClient() instead — same, synchronous. */
export async function getSharedClient() {
  return getSupabaseClient();
}
