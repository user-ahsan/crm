'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Task, TaskFormData, TaskPriority, TaskStatus } from '@/types/task.types';
import { taskService } from '@/services/task.service';
import { filterTasks, sortTasks, getOverdueTasks, getDueTodayTasks } from '@/modules/tasks/taskUtils';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      setTasks(taskService.getAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getFiltered = useCallback((status?: TaskStatus | 'all', priority?: TaskPriority | 'all') => {
    return filterTasks(tasks, status, priority);
  }, [tasks]);

  const getSorted = useCallback((by: 'dueDate' | 'priority' | 'createdAt' = 'dueDate') => {
    return sortTasks(tasks, by);
  }, [tasks]);

  const getByEntity = useCallback((entityType: string, entityId: string) => {
    return taskService.getByEntity(entityType, entityId);
  }, []);

  const overdue = useCallback(() => getOverdueTasks(tasks), [tasks]);
  const dueToday = useCallback(() => getDueTodayTasks(tasks), [tasks]);

  const createTask = useCallback((data: TaskFormData) => {
    try {
      const newTask = taskService.create(data);
      setTasks((prev) => [newTask, ...prev]);
      return newTask;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
      return undefined;
    }
  }, []);

  const updateTask = useCallback((id: string, data: Partial<TaskFormData & { status: TaskStatus }>) => {
    try {
      const updated = taskService.update(id, data);
      if (updated) setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update task');
      return undefined;
    }
  }, []);

  const toggleTask = useCallback((id: string) => {
    try {
      const updated = taskService.toggleStatus(id);
      if (updated) setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle task');
      return undefined;
    }
  }, []);

  const deleteTask = useCallback((id: string) => {
    try {
      const success = taskService.delete(id);
      if (success) setTasks((prev) => prev.filter((t) => t.id !== id));
      return success;
    } catch (e) {
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
