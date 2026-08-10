'use client';

import { useState, useCallback, useEffect } from 'react';
import type { SavedView, SavedViewFormData, ViewEntityType } from '@/types/saved-view.types';
import { savedViewService } from '@/services/saved-view.service';

/**
 * Saved-views hook — the single layer entry point for reading and mutating
 * saved views for one entity type (UI → Hook → Service → Data). Follows the
 * same shape as useTags: load on mount, refresh, and optimistic mutations
 * with rollback on failure.
 */
export function useSavedViews(entityType: ViewEntityType) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await savedViewService.getViews(entityType);
      setViews(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load saved views');
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await savedViewService.getViews(entityType);
        if (!cancelled) setViews(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load saved views');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entityType]);

  const createView = useCallback(async (data: SavedViewFormData): Promise<SavedView | undefined> => {
    try {
      const created = await savedViewService.create(data);
      setViews((prev) => [...prev, created]);
      return created;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save view');
      return undefined;
    }
  }, []);

  const updateView = useCallback(
    async (id: string, data: Partial<SavedViewFormData>): Promise<SavedView | undefined> => {
      let previous: SavedView | undefined;
      setViews((prev) => {
        previous = prev.find((v) => v.id === id);
        return prev.map((v) =>
          v.id === id
            ? {
                ...v,
                name: data.name ?? v.name,
                filters: data.filters ?? v.filters,
                sortBy: data.sortBy !== undefined ? data.sortBy : v.sortBy,
                sortOrder: data.sortOrder !== undefined ? data.sortOrder : v.sortOrder,
              }
            : v,
        );
      });
      try {
        const updated = await savedViewService.update(id, data);
        if (updated) setViews((prev) => prev.map((v) => (v.id === id ? updated : v)));
        return updated;
      } catch (e) {
        if (previous) setViews((prev) => prev.map((v) => (v.id === id ? previous! : v)));
        setError(e instanceof Error ? e.message : 'Failed to update view');
        return undefined;
      }
    },
    [],
  );

  const deleteView = useCallback(async (id: string): Promise<boolean> => {
    let previous: SavedView | undefined;
    setViews((prev) => {
      previous = prev.find((v) => v.id === id);
      return prev.filter((v) => v.id !== id);
    });
    try {
      await savedViewService.delete(id);
      return true;
    } catch (e) {
      if (previous) setViews((prev) => [...prev, previous!]);
      setError(e instanceof Error ? e.message : 'Failed to delete view');
      return false;
    }
  }, []);

  return {
    views,
    loading,
    error,
    refresh,
    createView,
    updateView,
    deleteView,
  };
}
