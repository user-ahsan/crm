import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * ─── Auth Routing Logic (Rate-Limit Safe) ─────────────────────────────
 *
 * Strategy to avoid Supabase Auth rate limits (30 req/hr on free tier):
 *   1. Check for Supabase session cookies FIRST — skip getUser() if absent
 *   2. Only call getUser() on protected routes where auth is required
 *   3. Skip getUser() entirely on auth routes (/login, /signup) — just redirect if cookies exist
 *   4. Landing page (/) never calls getUser()
 *
 * Route categories:
 *   Public       '/'               — always allowed, no auth call
 *   Auth         '/login','/signup' — redirect to dashboard if cookies exist (no getUser)
 *   Protected    all other routes   — redirect to /login if no user found
 * ─────────────────────────────────────────────────────────────────────
 */

const protectedRoutes = [
  '/dashboard', '/leads', '/contacts', '/companies',
  '/pipeline', '/tasks', '/meetings', '/analytics',
  '/settings', '/onboarding', '/deals', '/quotes',
  '/campaigns', '/goals', '/tags',
] as const;

const authRoutes = ['/login', '/signup'] as const;

/**
 * Quick check: does the request have any Supabase session cookies?
 * This is a local check — NO API call to Supabase.
 */
function hasSessionCookie(request: NextRequest): boolean {
  const cookies = request.cookies.getAll();
  return cookies.some((c) => c.name.startsWith('sb-'));
}

/**
 * Full auth check — calls Supabase getUser() (1 API call).
 * Only invoke this when we HAVE session cookies and NEED to verify.
 */
async function verifySession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  return [supabaseResponse, user !== null] as const;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Landing page — always allow, NO auth calls ever ──────────────
  if (pathname === '/') {
    return NextResponse.next({ request });
  }

  const isAuthRoute = authRoutes.some((r) => pathname === r);
  const isProtectedRoute = protectedRoutes.some((r) => pathname.startsWith(r));
  const hasCookies = hasSessionCookie(request);

  // ── Auth routes — redirect to dashboard if cookies exist (no getUser) ─
  if (isAuthRoute) {
    if (hasCookies) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next({ request }); // No session, show login/signup
  }

  // ── Protected routes — redirect to /login if no session ──────────
  if (isProtectedRoute) {
    // Fast path: no cookies at all → definitely not authenticated
    if (!hasCookies) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Cookies exist → verify with Supabase (1 API call per navigation)
    const [response, isAuthenticated] = await verifySession(request);
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // ── Other routes (campaigns/leads/etc catch-all) — pass through ─────
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
