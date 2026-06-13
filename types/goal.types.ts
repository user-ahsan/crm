export type GoalType = 'revenue' | 'deals_count' | 'leads_created' | 'tasks_completed' | 'calls_made' | 'custom';
export type GoalPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Goal {
  id: string;
  title: string;
  description: string;
  type: GoalType;
  target: number;
  current: number;
  period: GoalPeriod;
  startDate: string;
  endDate: string;
  assignedTo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalFormData {
  title: string;
  description?: string;
  type: GoalType;
  target: number;
  current?: number;
  period: GoalPeriod;
  startDate: string;
  endDate: string;
  assignedTo?: string;
}
