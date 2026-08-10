import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/supabase.types';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './client';

/**
 * Inactivity timeout in milliseconds (24 hours).
 * If the user has been idle longer than this, they are forced to re-auth.
 */
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Name of the cookie that tracks the last activity timestamp.
 */
const LAST_ACTIVITY_COOKIE = 'nexuscrm-last-activity';

/**
 * Result of a session update. `proxy.ts` branches on the VALIDATED `user`
 * (never on cookie presence) so a forged `sb-*` cookie cannot bypass
 * protected routes.
 */
export interface UpdateSessionResult {
  /** The response with any refreshed session cookies applied. */
  response: NextResponse;
  /** The validated user, or null when unauthenticated / session invalid. */
  user: User | null;
  /** True when Supabase is not configured (mock mode) — route everything through. */
  isMock: boolean;
  /** True when the idle-session timeout fired — response already redirects to /login?expired=true. */
  expired: boolean;
}

/**
 * Updates the Supabase session for every incoming request via Next.js proxy.
 *
 * This function reads cookies from the request, creates a Supabase server
 * client, refreshes session cookies on the response (via @supabase/ssr),
 * validates the session with `supabase.auth.getUser()`, and enforces a
 * 24-hour idle-session timeout.
 *
 * Mock mode: when Supabase env vars are absent, the app must still run
 * (mock-mode contract). No Auth API call is made and everything passes
 * through — `proxy.ts` routes all traffic in that case.
 *
 * @param request - The incoming Next.js request object.
 * @returns The response + validated user (see UpdateSessionResult).
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  const mockResponse = NextResponse.next({ request });

  // ── Mock mode — no Supabase configured: pass everything through ─────
  // (Consumes the mock-mode contract: no env vars → no Auth API call.)
  if (!isSupabaseConfigured()) {
    return { response: mockResponse, user: null, isMock: true, expired: false };
  }

  let supabaseResponse = NextResponse.next({ request });

  // Guard above guarantees both env vars are present (isSupabaseConfigured()).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  /**
   * IMPORTANT: Avoid writing any logic between createServerClient and
   * supabase.auth.getUser(). A simple mistake could make it hard to debug
   * issues with users being randomly logged out.
   */
  const { data: { user } } = await supabase.auth.getUser();

  // ── Session idle timeout check ──────────────────────────────────
  // Only enforce on protected routes that have a session
  if (user) {
    const lastActivity = request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
    const now = Date.now();

    if (lastActivity) {
      const lastTime = parseInt(lastActivity, 10);
      if (!isNaN(lastTime) && (now - lastTime) > SESSION_TIMEOUT_MS) {
        // Session expired due to inactivity — sign out and redirect
        await supabase.auth.signOut();
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('expired', 'true');
        const redirectResponse = NextResponse.redirect(loginUrl);
        // Carry the session-clearing cookies from the sign-out onto the
        // redirect so stale sb-* cookies don't survive the 307 and bounce
        // the user straight back into a protected route.
        for (const cookie of supabaseResponse.cookies.getAll()) {
          redirectResponse.cookies.set(cookie);
        }
        return { response: redirectResponse, user: null, isMock: false, expired: true };
      }
    }

    // Update last activity cookie on every request
    supabaseResponse.cookies.set(LAST_ACTIVITY_COOKIE, String(now), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TIMEOUT_MS / 1000, // match the timeout
    });
  }

  return { response: supabaseResponse, user, isMock: false, expired: false };
}
