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
import type { Database } from '@/types/supabase.types';

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

    _client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}

// ── Backward Compatibility ─────────────────────────────────────────────

/**
 * Returns the shared Supabase client (alias for backward compatibility).
 * Previously async `createClient`, now delegates to the sync singleton.
 */
export function getSharedClient() {
  return getSupabaseClient();
}

/** @deprecated Use getSupabaseClient() instead — synchronous singleton. */
export async function createClient() {
  return getSupabaseClient();
}

export const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

/**
 * Typed table query helper. Returns a typed query builder for the given table.
 * Use this instead of raw `supabase.from('table')` to get proper row types.
 *
 * @example
 * const { data } = await fromTable('leads').select('*');
 * // data is typed as LeadRow[] | null
 */
export function fromTable<T extends keyof Database['public']['Tables']>(table: T) {
  const supabase = getSupabaseClient();
  return supabase.from(table);
}

/**
 * Formats an unknown error into a human-readable string for use in
 * try/catch blocks and API error responses.
 */
export function formatSupabaseError(error: unknown): string {
  return error instanceof Error ? error.message : 'Database error';
}
