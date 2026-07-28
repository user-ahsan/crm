import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { AuthFooter } from './auth-footer';

/* ── Metadata ──────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: 'Auth - NexusCRM',
  description:
    'Sign in or create an account for NexusCRM — unified sales and relationship management.',
};

/* ── Props ────────────────────────────────────────────────── */
export interface AuthLayoutProps {
  children: ReactNode;
}

/* ── Auth Layout ──────────────────────────────────────────── */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100 px-4 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {children}
      <AuthFooter />
    </div>
  );
}
