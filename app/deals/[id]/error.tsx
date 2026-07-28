'use client';
import { ErrorState } from '@/components/common/ErrorState';
export default function DealDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState title="Failed to load deal" message={error.message} onRetry={reset} />
    </div>
  );
}
