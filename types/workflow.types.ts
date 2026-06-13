export type WorkflowEntityType = 'lead' | 'deal' | 'task';

export interface WorkflowState {
  id: string;
  name: string;
  color: string;
  entityType: WorkflowEntityType;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
}

export interface WorkflowTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  label: string;
  createdAt: string;
}

export interface WorkflowStateFormData {
  name: string;
  color: string;
  entityType: WorkflowEntityType;
}

export interface WorkflowTransitionFormData {
  fromStateId: string;
  toStateId: string;
  label: string;
}
