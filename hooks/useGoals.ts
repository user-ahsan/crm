'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Goal } from '@/types/goal.types';
import type { GoalInsert, GoalUpdate } from '@/types/supabase.types';
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
      id: `temp-${Date.now()}`,
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
    const previous = goals;
    const existing = goals.find((g) => g.id === id);
    if (!existing) return undefined;
    const optimistic: Goal = { ...existing, ...data as Partial<Goal>, updatedAt: new Date().toISOString() };
    setGoals((prev) => prev.map((g) => (g.id === id ? optimistic : g)));
    try {
      const updated = await goalService.update(id, data);
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
      return updated;
    } catch (e) {
      setGoals(previous);
      setError(e instanceof Error ? e.message : 'Failed to update goal');
      return undefined;
    }
  }, [goals]);

  const remove = useCallback(async (id: string) => {
    const previous = goals;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      await goalService.delete(id);
    } catch (e) {
      setGoals(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete goal');
    }
  }, [goals]);

  const getProgress = useCallback((goal: Goal): number => {
    return goalService.getProgress(goal);
  }, []);

  return { goals, loading, error, refresh, create, update, remove, getProgress };
}
