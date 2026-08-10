import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';
import { isSupabaseConfigured, getSupabaseClient, type SharedSupabaseClient } from './client';

/**
 * Server-side Supabase URL reader. Pure env read — safe to import in
 * Route Handlers (the browser variant must never be imported server-side).
 */
export const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

/**
 * Creates a Supabase client for server-side usage.
 * Use this in Server Components, Route Handlers, and Server Actions.
 *
 * Handles cookie-based authentication by reading and setting
 * cookies from the incoming request and outgoing response.
 *
 * MOCK MODE (no Supabase env vars): returns the shared mock client so
 * server routes never throw at construction and can read mock data.
 *
 * @returns A promise that resolves to a Supabase server client
 *          (real or mock depending on configuration).
 */
export async function createServerSupabaseClient(): Promise<SharedSupabaseClient> {
  // Mock mode — no env vars: no createServerClient, no cookies, no throw.
  if (!isSupabaseConfigured()) {
    return getSupabaseClient();
  }

  const cookieStore = await cookies();
  // Guard above guarantees both env vars are present (isSupabaseConfigured()).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
