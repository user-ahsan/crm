'use client';
import { ErrorState } from '@/components/common/ErrorState';
export default function NewInvoiceError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState title="Failed to load invoice form" message={error.message} onRetry={reset} />
    </div>
  );
}
