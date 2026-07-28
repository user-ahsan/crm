import type { RelatedEntityType } from './attachment.types';
export type { RelatedEntityType };

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export interface Task {
  id: string;
  title: string;
  description?: string;
  relatedToType?: RelatedEntityType;
  relatedToId?: string;
  assignedTo?: string;
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFormData {
  title: string;
  description?: string;
  relatedToType?: RelatedEntityType;
  relatedToId?: string;
  assignedTo?: string;
  dueDate?: string;
  priority: TaskPriority;
}
