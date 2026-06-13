'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ColumnDef, ColumnCustomizerProps } from './ColumnCustomizer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnManagerReturn {
  /** All column definitions (visible + hidden), in display order. */
  columns: ColumnDef[];
  /** Subset of `columns` where `visible === true`. */
  visibleColumns: ColumnDef[];
  /** Props to spread onto a `<ColumnCustomizer>` to let users edit columns. */
  customizerProps: ColumnCustomizerProps;
  /** Restore every column to its `defaultVisible` (or original `visible`). */
  resetColumns: () => void;
  /** Convenience alias. */
  setColumns: (columns: ColumnDef[]) => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed as T;
    }
  } catch {
    // Corrupt data – silently fall back
  }
  return fallback;
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded – silently degrade
  }
}

/**
 * Merge saved column state with the canonical defaults. This ensures that:
 *  - Saved visibility / ordering is preserved for columns that still exist.
 *  - New columns added to `defaults` after a save are appended at the end
 *    (with their default visibility).
 *  - Columns removed from `defaults` are silently dropped.
 */
function mergeColumns(
  saved: ColumnDef[] | null,
  defaults: ColumnDef[],
): ColumnDef[] {
  if (!saved) return defaults;

  const savedMap = new Map(saved.map((s) => [s.id, s]));
  const knownIds = new Set(defaults.map((d) => d.id));

  // Merge visibility onto defaults
  const merged = defaults.map((def) => {
    const s = savedMap.get(def.id);
    return s ? { ...def, visible: s.visible } : def;
  });

  // Keep saved ordering, drop orphaned ids, append new columns
  const savedOrder = saved
    .filter((s) => knownIds.has(s.id))
    .map((s) => merged.find((m) => m.id === s.id)!)
    .filter(Boolean);

  const newCols = merged.filter((m) => !saved.some((s) => s.id === m.id));

  return savedOrder.length > 0 || newCols.length > 0
    ? [...savedOrder, ...newCols]
    : merged;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages table column visibility and ordering with localStorage persistence.
 *
 * @param storageKey  Unique key for localStorage (e.g. `"leads-columns"`).
 * @param defaultColumns  Canonical list of all possible columns.
 *
 * @example
 * ```tsx
 * const { columns, visibleColumns, customizerProps } = useColumnManager(
 *   'leads-columns',
 *   LEAD_COLUMNS,
 * );
 *
 * return (
 *   <div>
 *     <ColumnCustomizer {...customizerProps} />
 *     <MyTable columns={visibleColumns} />
 *   </div>
 * );
 * ```
 */
export function useColumnManager(
  storageKey: string,
  defaultColumns: ColumnDef[],
): ColumnManagerReturn {
  // Hydrate state once on mount – merge saved + defaults
  const [columns, setColumns] = useState<ColumnDef[]>(() => {
    const saved = loadFromStorage<ColumnDef[] | null>(storageKey, null);
    return mergeColumns(saved, defaultColumns);
  });

  // Track the default set so we can detect structural changes
  // (columns added / removed at the definition site).
  const defaultsRef = useRef(defaultColumns);

  useEffect(() => {
    defaultsRef.current = defaultColumns;
  }, [defaultColumns]);

  // When the _shape_ of defaults changes structurally (new columns added,
  // columns removed), re‑merge while preserving user preferences.
  useEffect(() => {
    const prevIds = new Set(defaultsRef.current.map((d) => d.id));
    const currIds = new Set(defaultColumns.map((d) => d.id));

    // Only re‑merge when the set of column ids actually changes
    if (
      prevIds.size !== currIds.size ||
      [...prevIds].some((id) => !currIds.has(id))
    ) {
      setColumns((prev) => mergeColumns(prev, defaultColumns));
    }
  }, [defaultColumns]);

  // Persist to localStorage on every change
  useEffect(() => {
    saveToStorage(storageKey, columns);
  }, [columns, storageKey]);

  // ---- Derived values ----------------------------------------------------

  const visibleColumns = useMemo(
    () => columns.filter((col) => col.visible),
    [columns],
  );

  // ---- Handlers ----------------------------------------------------------

  const resetColumns = useCallback(() => {
    setColumns(
      defaultColumns.map((col) => ({
        ...col,
        visible: col.defaultVisible ?? col.visible,
      })),
    );
  }, [defaultColumns]);

  const handleChange = useCallback((next: ColumnDef[]) => {
    setColumns(next);
  }, []);

  // ---- Public API --------------------------------------------------------

  const customizerProps: ColumnCustomizerProps = useMemo(
    () => ({
      columns,
      onChange: handleChange,
      storageKey,
    }),
    [columns, handleChange, storageKey],
  );

  return {
    columns,
    visibleColumns,
    customizerProps,
    resetColumns,
    setColumns,
  };
}
