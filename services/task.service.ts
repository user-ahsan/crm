import { tasks } from '@/data/tasks';
import { activities } from '@/data/activities';
import type { Task, TaskFormData, TaskStatus } from '@/types/task.types';
import { generateId } from '@/lib/formatters';

export const taskService = {
  getAll(): Task[] {
    this.updateOverdueStatus();
    return [...tasks];
  },

  getById(id: string): Task | undefined {
    this.updateOverdueStatus();
    return tasks.find((t) => t.id === id);
  },

  getByEntity(entityType: string, entityId: string): Task[] {
    this.updateOverdueStatus();
    return tasks.filter((t) => t.relatedToType === entityType && t.relatedToId === entityId);
  },

  getByAssignedTo(userId: string): Task[] {
    this.updateOverdueStatus();
    return tasks.filter((t) => t.assignedTo === userId);
  },

  create(data: TaskFormData): Task {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...data,
      id: `task-${generateId().slice(0, 8)}`,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    tasks.unshift(newTask);
    activities.push({
      id: `act-${generateId().slice(0, 8)}`,
      entityType: 'task',
      entityId: newTask.id,
      type: 'task_created',
      description: `Task created: ${newTask.title}`,
      timestamp: now,
      metadata: { priority: newTask.priority },
    });
    return newTask;
  },

  update(id: string, data: Partial<TaskFormData & { status: TaskStatus }>): Task | undefined {
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return undefined;
    const oldStatus = tasks[index].status;
    const updated = {
      ...tasks[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    tasks[index] = updated;

    if (data.status && data.status !== oldStatus && data.status === 'completed') {
      activities.push({
        id: `act-${generateId().slice(0, 8)}`,
        entityType: 'task',
        entityId: id,
        type: 'task_completed',
        description: `Task completed: ${updated.title}`,
        timestamp: new Date().toISOString(),
      });
    }
    return updated;
  },

  toggleStatus(id: string): Task | undefined {
    const task = tasks.find((t) => t.id === id);
    if (!task) return undefined;
    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    return this.update(id, { status: newStatus });
  },

  delete(id: string): boolean {
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;
    tasks.splice(index, 1);
    return true;
  },

  updateOverdueStatus(): void {
    const now = new Date();
    for (const task of tasks) {
      if (task.dueDate && task.status === 'pending') {
        const dueDate = new Date(task.dueDate);
        if (dueDate < now) {
          task.status = 'overdue';
        }
      }
    }
  },
};
