import type { Task } from '@/types/task.types';

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
