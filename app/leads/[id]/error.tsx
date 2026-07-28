'use client';
import { ErrorState } from '@/components/common/ErrorState';
export default function LeadDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Failed to load lead" message={error.message} onRetry={reset} />;
}
