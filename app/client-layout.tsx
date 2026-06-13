'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/common/AppShell';
import { Toaster } from '@/components/ui/sonner';
import { TeamProvider } from '@/context/TeamContext';
import { useThemeStore } from '@/store';

/* ── Routes that should NOT render the AppShell ──────────── */
/* /login and /signup are standalone pages with no sidebar/navbar shell. */
/* /onboarding also has its own special layout (no sidebar). */
const AUTH_ROUTES = ['/login', '/signup'];
const ONBOARDING_ROUTE = '/onboarding';

/* ── Props ────────────────────────────────────────────────── */
export interface ClientLayoutProps {
  children: ReactNode;
}

/* ── Component ────────────────────────────────────────────── */
export default function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  const { theme } = useThemeStore();

  /*
    ── Theme class guard ──────────────────────────────────────
    The blocking <script> in layout.tsx already applies the 'dark' class
    synchronously before first paint. This useEffect is a safety net for
    any edge case where the store theme differs from the DOM class (e.g.
    the user changes theme in another tab). We toggle the class directly
    rather than calling setTheme() to avoid an unnecessary zustand state
    update that could trigger a re-render cascade.
  */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isLandingPage = pathname === '/';
  const isOnboarding =
    pathname === ONBOARDING_ROUTE ||
    pathname.startsWith(`${ONBOARDING_ROUTE}/`);

  /* ── TeamProvider wraps ALL routes (auth + app) so PermissionGuard works everywhere ───── */
  return (
    <TeamProvider>
      {isAuthRoute || isLandingPage || isOnboarding ? (
        <>
          {children}
          <Toaster />
        </>
      ) : (
        <AppShell>
          {children}
          <Toaster />
        </AppShell>
      )}
    </TeamProvider>
  );
}
