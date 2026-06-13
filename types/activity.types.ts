export type ActivityType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'note_added'
  | 'meeting_scheduled'
  | 'meeting_completed'
  | 'task_created'
  | 'task_completed'
  | 'communication_logged'
  | 'assigned';

export interface Activity {
  id: string;
  entityType: string;
  entityId: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
