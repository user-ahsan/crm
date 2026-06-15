import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import ClientLayout from './client-layout';

/* ── Font Configuration ──────────────────────────────────── */
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

/* ── Metadata ─────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: 'NexusCRM - Sales & Relationship Management',
  description:
    'Unified sales and relationship management platform for modern teams. Manage leads, pipeline, contacts, and analytics in one place.',
};

/* ── Root Layout ──────────────────────────────────────────── */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        'h-full',
        'antialiased',
        geistSans.variable,
        geistMono.variable,
        'font-sans',
      )}
    >
      <head>
        {/*
          ── FOUC Prevention (Theme Hydration Fix) ──────────────
          This blocking inline script reads the persisted theme from zustand's
          localStorage key *synchronously* during HTML parsing — before React
          hydrates or any JS bundles execute. This eliminates the white flash
          (FOUC) that dark-mode users experience when the theme class is applied
          too late via useEffect.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var e=JSON.parse(localStorage.getItem('nexuscrm-theme'));if(e&&e.state&&'dark'===e.state.theme)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
