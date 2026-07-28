'use client';
import { ErrorState } from '@/components/common/ErrorState';
export default function ContactDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Failed to load contact" message={error.message} onRetry={reset} />;
}
