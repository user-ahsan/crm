'use client';

import { ErrorState } from '@/components/common/ErrorState';

export default function MeetingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState message={error.message} onRetry={reset} />;
}
