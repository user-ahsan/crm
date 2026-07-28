'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from '@/components/ui/progress';
import { IconCheck } from '@tabler/icons-react';

/* ── Props ────────────────────────────────────────────────── */
export interface OnboardingLayoutProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
}

/* ── Step Labels ──────────────────────────────────────────── */
const STEP_LABELS = ['Welcome', 'Profile', 'Company', 'Goals', 'Complete'];

/* ── Component ────────────────────────────────────────────── */
export default function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
}: OnboardingLayoutProps) {
  const progress = Math.round((currentStep / (totalSteps - 1)) * 100);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* ── Branding ───────────────────────────────────────── */}
      <header className="flex shrink-0 items-center px-6 pt-5">
        <OnboardingLogo />
      </header>

      {/* ── Step Indicator ─────────────────────────────────── */}
      <nav
        className="mx-auto mt-8 flex w-full max-w-2xl items-center justify-center gap-0 px-6"
        aria-label="Onboarding progress"
      >
        {STEP_LABELS.map((label, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <div key={label} className="flex items-center">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    isCompleted &&
                      'bg-primary text-primary-foreground',
                    isCurrent &&
                      'border-2 border-primary bg-primary/10 text-primary',
                    isUpcoming &&
                      'border-2 border-muted-foreground/20 bg-transparent text-muted-foreground/50',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <IconCheck size={16} stroke={2.5} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    'hidden whitespace-nowrap text-xs font-medium transition-colors sm:inline',
                    isCompleted && 'text-primary',
                    isCurrent && 'text-foreground',
                    isUpcoming && 'text-muted-foreground/50',
                  )}
                >
                  {label}
                </span>
              </div>

              {/* Connector line between steps */}
              {index < totalSteps - 1 && (
                <div
                  className={cn(
                    'mx-2 h-px w-8 sm:mx-3 sm:w-12 md:w-16',
                    index < currentStep
                      ? 'bg-primary'
                      : 'bg-muted-foreground/20',
                  )}
                />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Progress Bar ───────────────────────────────────── */}
      <div className="mx-auto mt-6 w-full max-w-lg px-6">
        <Progress value={progress}>
          <ProgressTrack className="h-2 rounded-full">
            <ProgressIndicator className="rounded-full bg-primary transition-all duration-500 ease-out" />
          </ProgressTrack>
        </Progress>
      </div>

      {/* ── Main Content ───────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}

/** Dynamic logo for the onboarding header — shows custom logo if uploaded, falls back to text. */
function OnboardingLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/branding')
      .then(r => r.json())
      .then(json => {
        if (!cancelled && json.success && json.data?.logo_url) {
          setLogoUrl(json.data.logo_url);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (logoUrl) {
    return <img src={logoUrl} alt="Logo" className="max-h-8 max-w-48 rounded object-contain" />;
  }

  return <span className="text-lg font-bold tracking-tight text-foreground">NexusCRM</span>;
}
