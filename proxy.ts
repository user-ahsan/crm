import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/update-session';

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
 *   We look for 'sb-access-token' or 'sb-refresh-token' cookies set by
 *   the Supabase client. Presence of either cookie indicates an active
 *   session (or a token that can be refreshed).
 *
 * Session refresh:
 *   Every request calls updateSession() at the end so the cookie is
 *   silently refreshed on each navigation.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Protected route prefixes that require an active Supabase session.
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
  '/onboarding', // protected so only authenticated users can access; has its own special layout
] as const;

/**
 * Auth-only routes that redirect to /dashboard when the user is already
 * signed in (login and signup pages).
 */
const authRoutes = ['/login', '/signup'] as const;

/**
 * Public routes that do not require authentication. The landing page (/)
 * is always allowed even with a session.
 */
const publicRoutes = ['/', '/login', '/signup'] as const;

/**
 * Next.js proxy that refreshes the Supabase session on every request.
 *
 * - Public routes are always allowed, but auth routes (/login, /signup)
 *   redirect to /dashboard if the user already has a session.
 * - Protected routes without a valid session are redirected to /login
 *   with the original path as a ?redirect= parameter.
 * - Every response goes through updateSession() to refresh the cookie.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with any updated session cookies or a redirect.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Check for an active Supabase session ──────────────────────────
  const hasSession =
    request.cookies.has('sb-access-token') ||
    request.cookies.has('sb-refresh-token');

  // ── Landing page (/) — always allow, no redirect ever ─────────────
  if (pathname === '/') {
    return updateSession(request);
  }

  // ── Auth routes (/login, /signup) — redirect to dashboard if session exists ─
  const isAuthRoute = authRoutes.some((route) => pathname === route);
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ── Protected routes — redirect to /login if no session ───────────
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );

  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Always refresh the session for every request ──────────────────
  return updateSession(request);
}

/**
 * Proxy matcher – run on all routes except static assets and Next.js internals.
 */
export const config = {
  matcher: [
    // Skip static files, _next, and public assets
    '/((?!_next/static|_next/image|favicon.ico|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
