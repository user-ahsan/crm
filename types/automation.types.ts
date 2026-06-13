export type AutomationTriggerEvent =
  | 'lead.created' | 'lead.updated' | 'lead.status_changed'
  | 'contact.created' | 'contact.updated'
  | 'company.created' | 'company.updated'
  | 'task.created' | 'task.completed' | 'task.overdue'
  | 'meeting.created' | 'meeting.completed'
  | 'deal.created' | 'deal.stage_changed';

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'changed';
  value: string;
}

export interface AutomationAction {
  type: 'assign_user' | 'change_status' | 'add_tag' | 'send_email' | 'send_notification' | 'trigger_webhook';
  config: Record<string, string>;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  triggerEvent: AutomationTriggerEvent;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRuleFormData {
  name: string;
  description?: string;
  triggerEvent: AutomationTriggerEvent;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled?: boolean;
}
