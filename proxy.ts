import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/update-session';

/**
 * ─── Auth Routing (getUser()-based) ─────────────────────────────────
 *
 * Every request is passed through `updateSession`, which creates a
 * Supabase server client, refreshes session cookies (via @supabase/ssr),
 * enforces the 24h idle-session timeout, and calls
 * `supabase.auth.getUser()` to VALIDATE the session against the Auth API.
 *
 * Routing decisions are made on that validated user — never on cookie
 * presence — so a forged `sb-fake=1` cookie cannot serve protected routes.
 *
 * Flow:
 *   1. updateSession refreshes cookies + validates the user.
 *   2. Mock mode (no Supabase env vars): everything passes through.
 *   3. Idle timeout: updateSession already redirected to /login?expired=true.
 *   4. Auth routes (/login, /signup): validated user → /dashboard.
 *   5. Protected routes: no validated user → /login?redirect=<path>.
 *
 * API routes (/api/*) are not in protectedRoutes — they authenticate
 * internally with supabase.auth.getUser() and are reached directly.
 * ─────────────────────────────────────────────────────────────────────
 */

const protectedRoutes = [
  '/dashboard', '/leads', '/contacts', '/companies',
  '/pipeline', '/tasks', '/meetings', '/analytics',
  '/settings', '/onboarding', '/deals', '/quotes',
  '/campaigns', '/goals', '/tags', '/invoices',
] as const;

const authRoutes = ['/login', '/signup'] as const;

export async function proxy(request: NextRequest) {
  // Refresh the Supabase session + validate the user on every request
  const { response, user, isMock, expired } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // ── Mock mode (no Supabase configured) — pass everything through ──
  if (isMock) {
    return response;
  }

  // ── Idle timeout — updateSession already redirected to /login?expired=true ──
  if (expired) {
    return response;
  }

  // ── Landing page — always allow ──────────────────────────────
  if (pathname === '/') {
    return response;
  }

  // ── Auth routes — redirect to dashboard when already authenticated ──
  if (authRoutes.some((r) => pathname === r)) {
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // ── Protected routes — redirect to /login when no validated user ──
  if (protectedRoutes.some((r) => pathname.startsWith(r))) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // ── Everything else — pass through ────────────────────────────
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
