'use client';
import { ErrorState } from '@/components/common/ErrorState';
export default function CompanyDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Failed to load company" message={error.message} onRetry={reset} />;
}
