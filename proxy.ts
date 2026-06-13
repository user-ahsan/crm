import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase.types';

/**
 * ─── Auth Routing Logic ─────────────────────────────────────────────
 *
 * Route categories:
 *
 *   Public routes       ['/', '/login', '/signup']
 *     - Landing page (/) is always allowed — no redirect ever.
 *     - /login and /signup are allowed for unauthenticated users.
 *
 *   Auth routes         ['/login', '/signup']
 *     - If the user already has a session, redirect them to /dashboard.
 *       These pages make no sense for an already-logged-in user.
 *
 *   Protected routes    ['/dashboard', '/leads', '/contacts', …]
 *     - If the user has NO session, redirect to /login?redirect={path}
 *       so they come right back after signing in.
 *
 * Session check:
 *   We create a Supabase server client from the request cookies and
 *   call supabase.auth.getUser() to validate the actual session.
 *   This is far more reliable than guessing cookie names, because
 *   @supabase/ssr v0.12 uses cookie names like sb-{ref}-auth-token
 *   rather than the sb-access-token / sb-refresh-token convention.
 *
 * Session refresh:
 *   Every response goes through the same server client so Supabase
 *   silently refreshes the session cookies on each navigation.
 * ─────────────────────────────────────────────────────────────────────
 */

const protectedRoutes = [
  '/dashboard',
  '/leads',
  '/contacts',
  '/companies',
  '/pipeline',
  '/tasks',
  '/meetings',
  '/analytics',
  '/settings',
  '/onboarding',
] as const;

const authRoutes = ['/login', '/signup'] as const;

/**
 * Creates a Supabase server client for the middleware and performs
 * the auth check + cookie refresh in one call.
 *
 * @returns [supabaseResponse, isAuthenticated]
 */
async function checkSession(request: NextRequest) {
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
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // This validates the session with Supabase (not just cookie existence)
  const { data: { user } } = await supabase.auth.getUser();

  return [supabaseResponse, user !== null] as const;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Landing page (/) — always allow, no redirect ever ─────────────
  if (pathname === '/') {
    const [response] = await checkSession(request);
    return response;
  }

  // ── Check auth for all other routes ──────────────────────────────
  const [supabaseResponse, isAuthenticated] = await checkSession(request);

  // ── Auth routes (/login, /signup) — redirect to dashboard if session exists ─
  const isAuthRoute = authRoutes.some((route) => pathname === route);
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ── Protected routes — redirect to /login if no session ───────────
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
