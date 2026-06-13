import type { ReactNode } from 'react';
import Link from 'next/link';

/* ── Metadata ──────────────────────────────────────────────── */
export const metadata = {
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

      {/* Footer branding */}
      <footer className="absolute bottom-6 text-center text-xs text-muted-foreground/60">
        <Link href="/" className="hover:text-muted-foreground/90 transition-colors">
          &copy; NexusCRM
        </Link>
      </footer>
    </div>
  );
}
