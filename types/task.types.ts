export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'completed' | 'overdue';
export type RelatedEntityType = 'lead' | 'contact' | 'company';

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
