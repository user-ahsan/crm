'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEntityCache } from '@/store/entity-cache';
import { taskService } from '@/services/task.service';
import type { TaskFormData, TaskPriority, TaskStatus } from '@/types/task.types';
import { filterTasks, sortTasks, getOverdueTasks, getDueTodayTasks } from '@/modules/tasks/taskUtils';

export function useCachedTasks() {
  const tasks = useEntityCache((s) => s.tasks);
  const setTasks = useEntityCache((s) => s.setTasks);
  const updateTask = useEntityCache((s) => s.updateTask);
  const removeTask = useEntityCache((s) => s.removeTask);
  const [loading, setLoading] = useState(tasks.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refreshFromServer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await taskService.getAll();
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [setTasks]);

  useEffect(() => {
    if (tasks.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await taskService.getAll();
        if (!cancelled) setTasks(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load tasks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tasks.length, setTasks]);

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
    try {
      const created = await taskService.create(data);
      const { tasks: cached, setTasks: setCache } = useEntityCache.getState();
      setCache([created, ...cached]);
      return created;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
      return undefined;
    }
  }, []);

  const updateCachedTask = useCallback(async (id: string, data: Partial<TaskFormData & { status: TaskStatus }>) => {
    try {
      const updated = await taskService.update(id, data);
      if (updated) updateTask(id, updated);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update task');
      return undefined;
    }
  }, [updateTask]);

  const toggleCachedTask = useCallback(async (id: string) => {
    try {
      const updated = await taskService.toggleStatus(id);
      if (updated) updateTask(id, updated);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle task');
      return undefined;
    }
  }, [updateTask]);

  const deleteCachedTask = useCallback(async (id: string) => {
    try {
      await taskService.delete(id);
      removeTask(id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete task');
      return false;
    }
  }, [removeTask]);

  return {
    tasks,
    loading,
    error,
    refreshFromServer,
    getFiltered, getSorted, getByEntity, overdue, dueToday,
    createTask,
    updateTask: updateCachedTask,
    toggleTask: toggleCachedTask,
    deleteTask: deleteCachedTask,
  };
}
