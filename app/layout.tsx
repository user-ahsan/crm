import type { Metadata } from 'next';
import { Geist, Geist_Mono, DM_Sans, Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import ClientLayout from './client-layout';

/* ── Font Configuration ──────────────────────────────────── */
const interHeading = Inter({
  subsets: ['latin'],
  variable: '--font-heading',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

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
      className={cn(
        'h-full',
        'antialiased',
        geistSans.variable,
        geistMono.variable,
        'font-sans',
        dmSans.variable,
        interHeading.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
