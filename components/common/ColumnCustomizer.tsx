'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconColumns, IconGripVertical, IconRotate } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnDef {
  id: string;
  label: string;
  visible: boolean;
  /** Fallback visibility used by "Reset to Default". Defaults to `visible`. */
  defaultVisible?: boolean;
}

export interface ColumnCustomizerProps {
  /** Current column definitions. The component does NOT mutate this array. */
  columns: ColumnDef[];
  /** Called whenever columns are reordered or toggled. */
  onChange: (columns: ColumnDef[]) => void;
  /**
   * localStorage key for persisting column preferences across sessions.
   * When omitted, no persistence occurs.
   */
  storageKey?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Merge saved column state from localStorage with the canonical default list.
 * Keeps saved visibility & ordering for known columns and appends any new
 * columns that didn't exist when the save was written (e.g. after a feature
 * addition). Returns `null` when nothing is saved or the data is corrupt.
 */
function tryLoadFromStorage(
  storageKey: string,
  defaults: ColumnDef[],
): ColumnDef[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const saved: ColumnDef[] = JSON.parse(raw);
    if (!Array.isArray(saved)) return null;

    // Build a map for O(1) look‑up
    const savedMap = new Map(saved.map((s) => [s.id, s]));

    // Merge saved visibility onto defaults
    const merged = defaults.map((def) => {
      const savedCol = savedMap.get(def.id);
      return savedCol
        ? { ...def, visible: savedCol.visible }
        : def;
    });

    // Preserve saved ordering for columns that still exist in defaults
    const savedIds = new Set(saved.map((s) => s.id));
    const knownIds = new Set(defaults.map((d) => d.id));
    const ordered = saved
      .filter((s) => knownIds.has(s.id))
      .map((s) => merged.find((m) => m.id === s.id)!)
      .filter(Boolean);

    // Append any brand‑new columns that aren't in the saved set
    const newCols = merged.filter((m) => !savedIds.has(m.id));

    return ordered.length > 0 || newCols.length > 0
      ? [...ordered, ...newCols]
      : merged;
  } catch {
    // Corrupt JSON or storage error – silently fall back to defaults
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ColumnCustomizer({
  columns,
  onChange,
  storageKey,
}: ColumnCustomizerProps) {
  const [open, setOpen] = useState(false);

  // Drag-and-drop state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  // Guard to run localStorage initialisation exactly once
  const hydrated = useRef(false);

  // ---- Hydrate from localStorage on first mount --------------------------
  useEffect(() => {
    if (!storageKey || hydrated.current) return;
    hydrated.current = true;
    const saved = tryLoadFromStorage(storageKey, columns);
    if (saved) {
      onChange(saved);
    }
    // Intentionally run only once – columns & onChange are stable per the
    // contract but listed as deps for correctness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Persist to localStorage whenever columns change -------------------
  const prevColumns = useRef(columns);
  useEffect(() => {
    if (!storageKey || !hydrated.current) return;
    // Avoid writing on the initial hydration
    if (prevColumns.current !== columns) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(columns));
      } catch {
        // Quota exceeded – silently degrade
      }
    }
    prevColumns.current = columns;
  }, [columns, storageKey]);

  // ---- Derived values ----------------------------------------------------
  const visibleCount = columns.filter((c) => c.visible).length;
  const totalCount = columns.length;

  // ---- Event handlers ----------------------------------------------------

  const handleCheckChange = useCallback(
    (id: string, checked: boolean) => {
      onChange(
        columns.map((col) =>
          col.id === id ? { ...col, visible: checked } : col,
        ),
      );
    },
    [columns, onChange],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIdx(index);
      e.dataTransfer.effectAllowed = 'move';
      // Firefox requires data to be set
      e.dataTransfer.setData('text/plain', String(index));
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropIdx(index);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDropIdx(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === index) {
        setDragIdx(null);
        setDropIdx(null);
        return;
      }

      const next = [...columns];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(index, 0, moved);
      onChange(next);

      setDragIdx(null);
      setDropIdx(null);
    },
    [columns, dragIdx, onChange],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDropIdx(null);
  }, []);

  const handleReset = useCallback(() => {
    onChange(
      columns.map((col) => ({
        ...col,
        visible: col.defaultVisible ?? col.visible,
      })),
    );
  }, [columns, onChange]);

  // ---- Render ------------------------------------------------------------

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<button type="button" />}
        className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <IconColumns className="size-4" />
        {visibleCount} column{visibleCount !== 1 ? 's' : ''}
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-sm font-medium">Columns</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {visibleCount}/{totalCount} visible
          </span>
        </div>

        {/* Column list */}
        {totalCount === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No columns available
          </p>
        ) : (
          <ScrollArea className="max-h-80 px-1">
            <div className="py-1">
              {columns.map((col, index) => {
                const isDragging = dragIdx === index;
                const isDropTarget = dropIdx === index && dragIdx !== index;

                return (
                  <div
                    key={col.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                      'hover:bg-accent/50',
                      'cursor-default',
                      isDragging && 'opacity-40',
                      isDropTarget &&
                        'border-t-2 border-primary',
                    )}
                  >
                    {/* Drag handle */}
                    <IconGripVertical
                      className={cn(
                        'size-3.5 shrink-0 transition-colors',
                        'text-muted-foreground/30',
                        'group-hover:text-muted-foreground/60',
                        'cursor-grab active:cursor-grabbing',
                      )}
                    />

                    {/* Column label */}
                    <span className="flex-1 truncate select-none">
                      {col.label}
                    </span>

                    {/* Visibility toggle */}
                    <Checkbox
                      checked={col.visible}
                      onCheckedChange={(checked) =>
                        handleCheckChange(col.id, checked === true)
                      }
                      aria-label={`Toggle ${col.label} column`}
                    />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Reset */}
        {totalCount > 0 && (
          <>
            <Separator className="my-1" />
            <div className="px-3 pb-3 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={handleReset}
              >
                <IconRotate className="size-3.5" />
                Reset to Default
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
