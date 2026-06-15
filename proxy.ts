import { NextResponse, type NextRequest } from 'next/server';

/**
 * ─── Auth Routing (Zero API Calls) ─────────────────────────────────
 *
 * This middleware makes ZERO calls to Supabase Auth API.
 * It checks for the presence of any `sb-` cookie to determine if a user
 * has a session. This is sufficient for routing decisions.
 *
 * Why no getUser()?
 *   Supabase free tier rate-limits auth requests to ~30/hour. Every
 *   page navigation was triggering getUser() and exhausting the limit.
 *   Cookie-based routing avoids this entirely.
 *
 * Session expiry is handled client-side: when a Supabase API call returns
 * 401, the client redirects to /login.
 * ─────────────────────────────────────────────────────────────────────
 */

const protectedRoutes = [
  '/dashboard', '/leads', '/contacts', '/companies',
  '/pipeline', '/tasks', '/meetings', '/analytics',
  '/settings', '/onboarding', '/deals', '/quotes',
  '/campaigns', '/goals', '/tags',
] as const;

const authRoutes = ['/login', '/signup'] as const;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Landing page — always allow ──────────────────────────────
  if (pathname === '/') {
    return NextResponse.next({ request });
  }

  // ── Check for any Supabase session cookie (local, zero API calls) ─
  const cookies = request.cookies.getAll();
  const hasSession = cookies.some((c) => c.name.startsWith('sb-'));

  // ── Auth routes — redirect to dashboard if session exists ─────
  if (authRoutes.some((r) => pathname === r)) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next({ request });
  }

  // ── Protected routes — redirect to /login if no session ───────
  if (protectedRoutes.some((r) => pathname.startsWith(r))) {
    if (!hasSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next({ request });
  }

  // ── Everything else — pass through ────────────────────────────
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
