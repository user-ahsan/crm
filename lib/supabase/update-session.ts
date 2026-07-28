import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/supabase.types';

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
 * Updates the Supabase session for every incoming request via Next.js proxy.
 *
 * This function reads cookies from the request, creates a Supabase client,
 * and sets any updated cookies on the response. It also enforces an
 * idle session timeout: if the user's last activity cookie is older than
 * 24 hours, the session is considered expired and they are redirected to /login.
 *
 * @param request - The incoming Next.js request object.
 * @returns A NextResponse with any updated session cookies.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
        return NextResponse.redirect(loginUrl);
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

  return supabaseResponse;
}
