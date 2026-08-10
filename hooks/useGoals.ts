'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Goal } from '@/types/goal.types';
import type { GoalInsert, GoalUpdate } from '@/types/supabase.types';
import { generateId } from '@/lib/formatters';
import { goalService } from '@/services/goal.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useGoals() {
  const { user } = useCurrentUser();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await goalService.getAll();
      setGoals(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await goalService.getAll();
        if (!cancelled) setGoals(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load goals');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const create = useCallback(async (data: Omit<GoalInsert, 'created_by'>) => {
    if (!user?.id) return undefined;
    const optimistic: Goal = {
      id: generateId(),
      title: data.title,
      description: data.description ?? '',
      type: data.type,
      target: data.target ?? 0,
      current: data.current ?? 0,
      period: data.period,
      startDate: data.start_date,
      endDate: data.end_date,
      assignedTo: data.assigned_to ?? undefined,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setGoals((prev) => [optimistic, ...prev]);
    try {
      const created = await goalService.create({ ...data, created_by: user.id });
      setGoals((prev) => prev.map((g) => (g.id === optimistic.id ? created : g)));
      return created;
    } catch (e) {
      setGoals((prev) => prev.filter((g) => g.id !== optimistic.id));
      setError(e instanceof Error ? e.message : 'Failed to create goal');
      return undefined;
    }
  }, [user]);

  const update = useCallback(async (id: string, data: GoalUpdate) => {
    let prevItem: Goal | undefined;
    setGoals((prev) => {
      const existing = prev.find((g) => g.id === id);
      if (!existing) return prev;
      prevItem = { ...existing };
      return prev.map((g) => (g.id === id ? { ...existing, ...data as Partial<Goal>, updatedAt: new Date().toISOString() } : g));
    });
    if (!prevItem) return undefined;
    try {
      const updated = await goalService.update(id, data);
      // update returns undefined when the goal no longer exists (PGRST116) —
      // keep the last known item so the list never contains an undefined row.
      setGoals((prev) => prev.map((g) => (g.id === id ? (updated ?? g) : g)));
      return updated;
    } catch (e) {
      if (prevItem) setGoals((prev) => prev.map((g) => (g.id === id ? prevItem! : g)));
      setError(e instanceof Error ? e.message : 'Failed to update goal');
      return undefined;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    let prevItem: Goal | undefined;
    setGoals((prev) => {
      prevItem = prev.find((g) => g.id === id);
      return prev.filter((g) => g.id !== id);
    });
    try {
      const ok = await goalService.delete(id);
      return ok;
    } catch (e) {
      if (prevItem) setGoals((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete goal');
      return false;
    }
  }, []);

  const getProgress = useCallback((goal: Goal): number => {
    return goalService.getProgress(goal);
  }, []);

  /**
   * Recomputes a goal's `current` from live CRM data via
   * goalService.recalculateProgress (FEATURES §15 — revenue from won deals,
   * tasks_completed from completed tasks, etc.). Returns the new current value
   * on success, undefined on failure. Updates the goal in the local list so
   * the progress bar reflects the new value without a full refetch.
   */
  const recalculateProgress = useCallback(async (goalId: string): Promise<number | undefined> => {
    const target = goals.find((g) => g.id === goalId);
    if (!target) return undefined;
    try {
      const result = await goalService.recalculateProgress(target);
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId ? { ...g, current: result.current, updatedAt: new Date().toISOString() } : g,
        ),
      );
      return result.current;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to recalculate goal progress');
      return undefined;
    }
  }, [goals]);

  return { goals, loading, error, refresh, create, update, remove, getProgress, recalculateProgress };
}
