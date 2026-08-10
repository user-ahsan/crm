'use client';

import { useState } from 'react';
import { IconLoader } from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  variant?: 'default' | 'destructive';
  /** Shows a spinner and disables the confirm button while the action is in flight. */
  loading?: boolean;
  /** Inline error rendered above the footer when the confirm action fails. */
  error?: string | null;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirm',
  variant = 'default',
  loading = false,
  error = null,
}: ConfirmDialogProps) {
  // Internal in-flight guard so double-clicks can never fire the destructive
  // action twice even when the caller does not pass the `loading` prop.
  const [submitting, setSubmitting] = useState(false);
  const busy = loading || submitting;

  const handleConfirm = async () => {
    if (busy) return;
    setSubmitting(true);
    try {
      await onConfirm();
      // Callers own the close-on-success contract (they close their open-state
      // only after the action succeeds); we never close here so a swallowed
      // failure cannot dismiss the dialog silently.
    } catch {
      // Keep the dialog open; the caller surfaces the failure via `error`.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={busy}
            className={cn(
              variant === 'destructive' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            )}
          >
            {busy && <IconLoader className="size-4 animate-spin" />}
            {busy ? `${confirmLabel}ing…` : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmDialog;
