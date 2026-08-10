/**
 * ─── Supabase Client ────────────────────────────────────────────────────
 *
 * Provides a singleton Supabase browser client using @supabase/ssr for
 * cookie-based session management. All services should use this shared
 * instance rather than creating their own.
 *
 * MOCK MODE (documented default — see .tmp/audit/fixes/PATTERN-mock-mode.md):
 * When NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are absent,
 * getSupabaseClient()/getSharedClient() return a typed, network-free mock
 * client backed by the data/*.ts arrays. No throw, no env required — the
 * app renders and every service works against in-memory mock data.
 * When the env vars ARE present, the real Supabase client is used.
 *
 * Environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL  — Your Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — Your Supabase anonymous API key
 * ───────────────────────────────────────────────────────────────────────
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase.types';
import { createMockClient, type MockSupabaseClient } from './mock-client';

// ── Configuration check ────────────────────────────────────────────────

/**
 * Returns whether real Supabase credentials are configured.
 * `false` means the app runs in mock mode (data/*.ts in-memory store).
 */
export function isSupabaseConfigured(): boolean {
  return !!(
    typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Union of the real Supabase client and the mock client. Services written
 * against `getSharedClient()` keep compiling unchanged: the real member
 * preserves today's behavior and the mock member implements the same
 * PostgREST-shaped query surface.
 */
export type SharedSupabaseClient = ReturnType<typeof createBrowserClient> | MockSupabaseClient;

// ── Singleton instance ─────────────────────────────────────────────────

let _client: SharedSupabaseClient | null = null;

/**
 * Returns the shared Supabase client (synchronous singleton).
 * Real browser client when env vars are configured, mock client otherwise.
 * Never throws on missing environment variables.
 */
export function getSupabaseClient(): SharedSupabaseClient {
  if (!_client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      _client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
    } else {
      _client = createMockClient();
    }
  }
  return _client;
}

// ── Backward Compatibility ─────────────────────────────────────────────

/**
 * Returns the shared Supabase client (alias for backward compatibility).
 * Previously async `createClient`, now delegates to the sync singleton.
 */
export function getSharedClient(): SharedSupabaseClient {
  return getSupabaseClient();
}

/** @deprecated Use getSupabaseClient() instead — synchronous singleton. */
export async function createClient(): Promise<SharedSupabaseClient> {
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
