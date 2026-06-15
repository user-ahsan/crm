import type { Task, TaskPriority, TaskStatus } from '@/types/task.types';

export function filterTasks(tasks: Task[], status?: TaskStatus | 'all', priority?: TaskPriority | 'all'): Task[] {
  return tasks.filter((t) => {
    if (status && status !== 'all' && t.status !== status) return false;
    if (priority && priority !== 'all' && t.priority !== priority) return false;
    return true;
  });
}

export function getOverdueTasks(tasks: Task[]): Task[] {
  const now = new Date();
  return tasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < now;
  });
}

export function getDueTodayTasks(tasks: Task[]): Task[] {
  const now = new Date();
  // Build today's bounds in LOCAL timezone
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  return tasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (!t.dueDate) return false;
    // Parse dueDate as LOCAL date (works for "2026-06-14" and ISO strings)
    const due = new Date(t.dueDate);
    const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    return dueLocal >= todayStart && dueLocal < todayEnd;
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
