'use client';

import { useCallback } from 'react';
import type { WorkflowTransition, WorkflowState } from '@/types/workflow.types';
import { Button } from '@/components/ui/button';
import { IconTrash, IconArrowRight } from '@tabler/icons-react';

interface WorkflowTransitionLineProps {
  transition: WorkflowTransition;
  fromState: WorkflowState | undefined;
  toState: WorkflowState | undefined;
  onDelete: (id: string) => void;
}

/**
 * Renders a single transition as a visual arrow connector.
 * Shows source → target with optional label and a delete button.
 */
export function WorkflowTransitionLine({
  transition,
  fromState,
  toState,
  onDelete,
}: WorkflowTransitionLineProps) {
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(transition.id);
    },
    [transition.id, onDelete],
  );

  const fromColor = fromState?.color ?? '#888';
  const toColor = toState?.color ?? '#888';

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40">
      {/* Source state indicator */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="inline-block size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: fromColor }}
        />
        <span className="truncate text-xs font-medium">
          {fromState?.name ?? (
            <span className="italic text-muted-foreground">Deleted</span>
          )}
        </span>
      </div>

      {/* Arrow */}
      <IconArrowRight size={14} className="shrink-0 text-muted-foreground" />

      {/* Label (optional) */}
      {transition.label && (
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {transition.label}
        </span>
      )}

      {/* Target state indicator */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="inline-block size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: toColor }}
        />
        <span className="truncate text-xs font-medium">
          {toState?.name ?? (
            <span className="italic text-muted-foreground">Deleted</span>
          )}
        </span>
      </div>

      {/* Delete button — visible on hover */}
      <div className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="size-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
          aria-label={`Delete transition from ${fromState?.name ?? '?'} to ${toState?.name ?? '?'}`}
        >
          <IconTrash size={12} />
        </Button>
      </div>
    </div>
  );
}
