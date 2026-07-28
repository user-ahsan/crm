import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { THEME_HYDRATION_SCRIPT } from '@/lib/constants';
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

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
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

          SAFE: THEME_HYDRATION_SCRIPT is a static string literal imported from
          lib/constants.ts. It contains no user input, no dynamic interpolation,
          and no runtime-generated content. The dangerouslySetInnerHTML pattern
          is required here because Next.js escapes JSX children in <script>
          tags, and this must execute synchronously before React hydrates.
          The script content is auditable in a single constant location.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_HYDRATION_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
