'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Task, TaskFormData, TaskPriority, TaskStatus } from '@/types/task.types';
import { generateId } from '@/lib/formatters';
import { taskService } from '@/services/task.service';
import { filterTasks, sortTasks } from '@/modules/tasks/taskUtils';
import { getOverdueTasks as getOverdueTasksUtil, getDueTodayTasks as getDueTodayTasksUtil } from '@/lib/task-utils';
import { useEntityCache, isCacheStale } from '@/store/entity-cache';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await taskService.getAll();
      setTasks(data);
      const store = useEntityCache.getState();
      store.setTasks(data);
      store.setLastFetched('tasks');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // P8: Skip fetch if cache is fresh
    const store = useEntityCache.getState();
    if (!isCacheStale(store, 'tasks') && store.tasks.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTasks(store.tasks);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const getFiltered = useCallback((status?: TaskStatus | 'all', priority?: TaskPriority | 'all') => {
    return filterTasks(tasks, status, priority);
  }, [tasks]);

  const getSorted = useCallback((by: 'dueDate' | 'priority' | 'createdAt' = 'dueDate') => {
    return sortTasks(tasks, by);
  }, [tasks]);

  const getById = useCallback(async (id: string) => {
    try {
      return await taskService.getById(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load task');
      return undefined;
    }
  }, []);

  const getByEntity = useCallback(async (entityType: string, entityId: string) => {
    try {
      return await taskService.getByEntity(entityType, entityId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
      return [];
    }
  }, []);

  // Existing overdue/dueToday accessors (kept for callers) — the documented
  // getOverdueTasks/getDueTodayTasks names are aliases delegating to lib/task-utils.
  const overdue = useCallback(() => getOverdueTasksUtil(tasks), [tasks]);
  const dueToday = useCallback(() => getDueTodayTasksUtil(tasks), [tasks]);
  const getOverdueTasks = useCallback(() => getOverdueTasksUtil(tasks), [tasks]);
  const getDueTodayTasks = useCallback(() => getDueTodayTasksUtil(tasks), [tasks]);

  const createTask = useCallback(async (data: TaskFormData) => {
    const tempId = generateId();
    const optimisticItem: Task = {
      id: tempId,
      title: data.title,
      description: data.description,
      relatedToType: data.relatedToType,
      relatedToId: data.relatedToId,
      assignedTo: data.assignedTo,
      dueDate: data.dueDate,
      priority: data.priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks((prev) => [optimisticItem, ...prev]);
    try {
      const created = await taskService.create(data);
      setTasks((prev) => prev.map((t) => (t.id === tempId ? created : t)));
      const { tasks: cached, setTasks: setCache } = useEntityCache.getState();
      setCache([created, ...cached]);
      return created;
    } catch (e) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create task');
      return undefined;
    }
  }, []);

  const updateTask = useCallback(async (id: string, data: Partial<TaskFormData & { status: TaskStatus }>) => {
    // Capture the pre-mutation row OUTSIDE the state updater so rollback can
    // restore the exact object at its original index (ARCHITECTURE §10).
    const prevItem = tasks.find((t) => t.id === id);
    if (!prevItem) return undefined;
    const prevIndex = tasks.indexOf(prevItem);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    try {
      const updated = await taskService.update(id, data);
      if (!updated) {
        // PGRST116 not-found: revert the optimistic change and surface it.
        setTasks((prev) => {
          const next = prev.filter((t) => t.id !== id);
          next.splice(Math.min(prevIndex, next.length), 0, prevItem);
          return next;
        });
        setError('Failed to update task: record not found');
        return undefined;
      }
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      useEntityCache.getState().updateTask(id, updated);
      return updated;
    } catch (e) {
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to update task');
      return undefined;
    }
  }, [tasks]);

  const toggleTask = useCallback(async (id: string) => {
    const prevItem = tasks.find((t) => t.id === id);
    if (!prevItem) return undefined;
    const prevIndex = tasks.indexOf(prevItem);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
      )
    );
    try {
      const updated = await taskService.toggleStatus(id);
      if (!updated) {
        // toggleStatus returns undefined when the row no longer matches a
        // pending/completed update — revert the optimistic flip.
        setTasks((prev) => {
          const next = prev.filter((t) => t.id !== id);
          next.splice(Math.min(prevIndex, next.length), 0, prevItem);
          return next;
        });
        setError('Failed to toggle task: record not found');
        return undefined;
      }
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      useEntityCache.getState().updateTask(id, updated);
      return updated;
    } catch (e) {
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to toggle task');
      return undefined;
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id: string) => {
    const prevItem = tasks.find((t) => t.id === id);
    if (!prevItem) return false;
    const prevIndex = tasks.indexOf(prevItem);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await taskService.delete(id);
      useEntityCache.getState().removeTask(id);
      return true;
    } catch (e) {
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to delete task');
      return false;
    }
  }, [tasks]);

  return {
    tasks, loading, error, refresh,
    getFiltered, getSorted, getById, getByEntity,
    overdue, dueToday, getOverdueTasks, getDueTodayTasks,
    createTask, updateTask, toggleTask, deleteTask,
  };
}
