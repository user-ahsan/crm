'use client';

import { useState, useCallback, useEffect } from 'react';
import type { WorkflowState, WorkflowTransition, WorkflowStateFormData, WorkflowTransitionFormData, WorkflowEntityType } from '@/types/workflow.types';
import { workflowService } from '@/services/workflow.service';
import { generateId } from '@/lib/formatters';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useWorkflows(entityType: WorkflowEntityType) {
  const [states, setStates] = useState<WorkflowState[]>([]);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useCurrentUser();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stateData, transitionData] = await Promise.all([
        workflowService.getStates(entityType),
        workflowService.getTransitions(),
      ]);
      setStates(stateData);
      setTransitions(transitionData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workflows');
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
        const [stateData, transitionData] = await Promise.all([
          workflowService.getStates(entityType),
          workflowService.getTransitions(),
        ]);
        if (!cancelled) {
          setStates(stateData);
          setTransitions(transitionData);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load workflows');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entityType]);

  const createState = useCallback(async (data: WorkflowStateFormData) => {
    const tempId = generateId();
    let sortOrder = 0;
    setStates((prev) => { sortOrder = prev.length; return prev; });
    const optimisticItem: WorkflowState = {
      id: tempId,
      name: data.name,
      color: data.color,
      entityType: data.entityType,
      sortOrder,
      createdBy: currentUser?.id ?? '',
      createdAt: new Date().toISOString(),
    };
    setStates((prev) => [...prev, optimisticItem]);
    try {
      const created = await workflowService.createState({ ...data, createdBy: currentUser?.id ?? '' });
      setStates((prev) => prev.map((s) => (s.id === tempId ? created : s)));
      return created;
    } catch (e) {
      setStates((prev) => prev.filter((s) => s.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create state');
      return undefined;
    }
  }, [currentUser]);

  const updateState = useCallback(async (id: string, updates: { name?: string; color?: string }) => {
    let prevItem: WorkflowState | undefined;
    setStates((prev) => {
      prevItem = prev.find((s) => s.id === id);
      return prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
    });
    try {
      const updated = await workflowService.updateState(id, updates);
      if (updated) {
        setStates((prev) => prev.map((s) => (s.id === id ? updated : s)));
      }
      return updated;
    } catch (e) {
      if (prevItem) setStates((prev) => prev.map((s) => (s.id === id ? prevItem! : s)));
      setError(e instanceof Error ? e.message : 'Failed to update state');
      return undefined;
    }
  }, []);

  const deleteState = useCallback(async (id: string) => {
    let prevItem: WorkflowState | undefined;
    let prevTransitions: WorkflowTransition[] | undefined;
    setStates((prev) => {
      prevItem = prev.find((s) => s.id === id);
      return prev.filter((s) => s.id !== id);
    });
    setTransitions((prev) => {
      prevTransitions = prev.filter((t) => t.fromStateId === id || t.toStateId === id);
      return prev.filter((t) => t.fromStateId !== id && t.toStateId !== id);
    });
    try {
      await workflowService.deleteState(id);
      return true;
    } catch (e) {
      if (prevItem) setStates((prev) => [...prev, prevItem!]);
      if (prevTransitions && prevTransitions.length > 0) setTransitions((prev) => [...prev, ...(prevTransitions ?? [])]);
      setError(e instanceof Error ? e.message : 'Failed to delete state');
      return false;
    }
  }, []);

  const reorderStates = useCallback(async (ids: string[]) => {
    let previous: WorkflowState[] | undefined;
    setStates((prev) => {
      previous = [...prev];
      const reordered = ids.map((id, i) => {
        const existing = prev.find((s) => s.id === id);
        return existing ? { ...existing, sortOrder: i } : existing;
      }).filter(Boolean) as WorkflowState[];
      return reordered;
    });
    try {
      await workflowService.reorderStates(ids);
      return true;
    } catch (e) {
      if (previous) setStates(previous);
      setError(e instanceof Error ? e.message : 'Failed to reorder states');
      return false;
    }
  }, []);

  const createTransition = useCallback(async (data: WorkflowTransitionFormData) => {
    const tempId = generateId();
    const optimistic: WorkflowTransition = {
      id: tempId,
      fromStateId: data.fromStateId,
      toStateId: data.toStateId,
      label: data.label,
      createdAt: new Date().toISOString(),
    };
    setTransitions((prev) => [...prev, optimistic]);
    try {
      const created = await workflowService.createTransition(data);
      setTransitions((prev) => prev.map((t) => (t.id === tempId ? created : t)));
      return created;
    } catch (e) {
      setTransitions((prev) => prev.filter((t) => t.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create transition');
      return undefined;
    }
  }, []);

  const deleteTransition = useCallback(async (id: string) => {
    let prevItem: WorkflowTransition | undefined;
    setTransitions((prev) => {
      prevItem = prev.find((t) => t.id === id);
      return prev.filter((t) => t.id !== id);
    });
    try {
      await workflowService.deleteTransition(id);
      return true;
    } catch (e) {
      if (prevItem) setTransitions((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete transition');
      return false;
    }
  }, []);

  const getFilteredTransitions = useCallback((fromIds: string[]) => {
    return transitions.filter((t) => fromIds.includes(t.fromStateId));
  }, [transitions]);

  return {
    states, transitions, loading, error, refresh,
    createState, updateState, deleteState, reorderStates,
    createTransition, deleteTransition, getFilteredTransitions,
  };
}
