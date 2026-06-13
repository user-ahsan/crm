'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/common/AppShell';
import { Toaster } from '@/components/ui/sonner';
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
  const { theme, setTheme } = useThemeStore();

  /* Hydrate theme class on <html> from persisted store */
  useEffect(() => {
    setTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isLandingPage = pathname === '/';
  const isOnboarding =
    pathname === ONBOARDING_ROUTE ||
    pathname.startsWith(`${ONBOARDING_ROUTE}/`);

  /* ── Auth, landing & onboarding pages: standalone (no AppShell) ──── */
  if (isAuthRoute || isLandingPage || isOnboarding) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  /* ── All other routes: wrapped in AppShell ───────────── */
  return (
    <AppShell>
      {children}
      <Toaster />
    </AppShell>
  );
}
