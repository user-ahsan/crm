import type { Task, TaskPriority, TaskStatus } from '@/types/task.types';

// Re-export shared task utilities from lib to avoid cross-module imports
export { getDueTodayTasks, getOverdueTasks } from '@/lib/task-utils';

export function filterTasks(tasks: Task[], status?: TaskStatus | 'all', priority?: TaskPriority | 'all'): Task[] {
  return tasks.filter((t) => {
    if (status && status !== 'all' && t.status !== status) return false;
    if (priority && priority !== 'all' && t.priority !== priority) return false;
    return true;
  });
}

export function sortTasks(tasks: Task[], by: 'dueDate' | 'priority' | 'createdAt' = 'dueDate'): Task[] {
  const priorityOrder: Record<TaskPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return [...tasks].sort((a, b) => {
    if (by === 'priority') return (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0);
    if (by === 'dueDate') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
