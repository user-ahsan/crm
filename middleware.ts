import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

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
] as const;

/**
 * Public routes that do not require authentication.
 */
const publicRoutes = ['/', '/login'] as const;

/**
 * Next.js middleware that refreshes the Supabase session on every request.
 *
 * - Requests to protected routes without a valid session are redirected to /login.
 * - Requests to /login for already-authenticated users are redirected to /dashboard.
 * - All other requests proceed normally with the session cookies refreshed.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with any updated session cookies or a redirect.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always refresh the session for every request
  const response = await updateSession(request);

  // Check if the current path is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check if the user has an active session
  const hasSession = request.cookies.has('sb-access-token') ||
    request.cookies.has('sb-refresh-token');

  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from the login page
  const isPublicRoute = publicRoutes.some((route) => pathname === route);
  if (isPublicRoute && hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

/**
 * Middleware matcher – run on all routes except static assets and Next.js internals.
 */
export const config = {
  matcher: [
    // Skip static files, _next, and API routes that don't need auth
    '/((?!_next/static|_next/image|favicon.ico|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
