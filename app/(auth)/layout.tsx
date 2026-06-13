import type { ReactNode } from 'react';

/* ── Props ────────────────────────────────────────────────── */
export interface AuthLayoutProps {
  children: ReactNode;
}

/* ── Auth Layout ──────────────────────────────────────────── */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100 px-4 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {children}
    </div>
  );
}
