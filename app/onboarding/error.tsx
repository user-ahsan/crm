'use client';
import { ErrorState } from '@/components/common/ErrorState';
export default function OnboardingError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Onboarding error" message={error.message} onRetry={reset} />;
}
