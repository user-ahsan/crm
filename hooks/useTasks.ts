'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Task, TaskFormData, TaskPriority, TaskStatus } from '@/types/task.types';
import { taskService } from '@/services/task.service';
import { filterTasks, sortTasks, getOverdueTasks, getDueTodayTasks } from '@/modules/tasks/taskUtils';
import { useEntityCache } from '@/store/entity-cache';

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
      useEntityCache.getState().setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    taskService.getAll()
      .then((data) => {
        if (cancelled) return;
        setTasks(data);
        useEntityCache.getState().setTasks(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load tasks');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const getFiltered = useCallback((status?: TaskStatus | 'all', priority?: TaskPriority | 'all') => {
    return filterTasks(tasks, status, priority);
  }, [tasks]);

  const getSorted = useCallback((by: 'dueDate' | 'priority' | 'createdAt' = 'dueDate') => {
    return sortTasks(tasks, by);
  }, [tasks]);

  const getByEntity = useCallback(async (entityType: string, entityId: string) => {
    try {
      return await taskService.getByEntity(entityType, entityId);
    } catch {
      return [];
    }
  }, []);

  const overdue = useCallback(() => getOverdueTasks(tasks), [tasks]);
  const dueToday = useCallback(() => getDueTodayTasks(tasks), [tasks]);

  const createTask = useCallback(async (data: TaskFormData) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticItem = { ...data, id: tempId, createdAt: new Date().toISOString() } as Task;
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
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    try {
      const updated = await taskService.update(id, data);
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
        useEntityCache.getState().updateTask(id, updated);
      }
      return updated;
    } catch (e) {
      setTasks(previous);
      setError(e instanceof Error ? e.message : 'Failed to update task');
      return undefined;
    }
  }, [tasks]);

  const toggleTask = useCallback(async (id: string) => {
    const previous = tasks;
    setTasks((prev) => prev.map((t) =>
      t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' as TaskStatus } : t
    ));
    try {
      const updated = await taskService.toggleStatus(id);
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
        useEntityCache.getState().updateTask(id, updated);
      }
      return updated;
    } catch (e) {
      setTasks(previous);
      setError(e instanceof Error ? e.message : 'Failed to toggle task');
      return undefined;
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id: string) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await taskService.delete(id);
      useEntityCache.getState().removeTask(id);
      return true;
    } catch (e) {
      setTasks(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete task');
      return false;
    }
  }, [tasks]);

  return {
    tasks, loading, error, refresh,
    getFiltered, getSorted, getByEntity, overdue, dueToday,
    createTask, updateTask, toggleTask, deleteTask,
  };
}
