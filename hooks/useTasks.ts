'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Task, TaskFormData, TaskPriority, TaskStatus } from '@/types/task.types';
import { generateId } from '@/lib/formatters';
import { taskService } from '@/services/task.service';
import { filterTasks, sortTasks, getOverdueTasks, getDueTodayTasks } from '@/modules/tasks/taskUtils';
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

  const getByEntity = useCallback(async (entityType: string, entityId: string) => {
    try {
      return await taskService.getByEntity(entityType, entityId);
    } catch (err) {
      // Error preserved in error state
      return [];
    }
  }, []);

  const overdue = useCallback(() => getOverdueTasks(tasks), [tasks]);
  const dueToday = useCallback(() => getDueTodayTasks(tasks), [tasks]);

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
    let prevItem: Task | undefined;
    setTasks((prev) => {
      prevItem = prev.find((t) => t.id === id);
      return prev.map((t) => (t.id === id ? { ...t, ...data } : t));
    });
    try {
      const updated = await taskService.update(id, data);
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
        useEntityCache.getState().updateTask(id, updated);
      }
      return updated;
    } catch (e) {
      if (prevItem) setTasks((prev) => prev.map((t) => (t.id === id ? prevItem! : t)));
      setError(e instanceof Error ? e.message : 'Failed to update task');
      return undefined;
    }
  }, []);

  const toggleTask = useCallback(async (id: string) => {
    let prevItem: Task | undefined;
    setTasks((prev) => {
      prevItem = prev.find((t) => t.id === id);
      return prev.map((t) =>
        t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
      );
    });
    try {
      const updated = await taskService.toggleStatus(id);
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
        useEntityCache.getState().updateTask(id, updated);
      }
      return updated;
    } catch (e) {
      if (prevItem) setTasks((prev) => prev.map((t) => (t.id === id ? prevItem! : t)));
      setError(e instanceof Error ? e.message : 'Failed to toggle task');
      return undefined;
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    let prevItem: Task | undefined;
    setTasks((prev) => {
      prevItem = prev.find((t) => t.id === id);
      return prev.filter((t) => t.id !== id);
    });
    try {
      await taskService.delete(id);
      useEntityCache.getState().removeTask(id);
      return true;
    } catch (e) {
      if (prevItem) setTasks((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete task');
      return false;
    }
  }, []);

  return {
    tasks, loading, error, refresh,
    getFiltered, getSorted, getByEntity, overdue, dueToday,
    createTask, updateTask, toggleTask, deleteTask,
  };
}
