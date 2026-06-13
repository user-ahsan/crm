import { activities } from '@/data/activities';
import type { Activity, ActivityType } from '@/types/activity.types';
import { generateId } from '@/lib/formatters';

let localActivities = activities;

export const activityService = {
  getAll(): Activity[] {
    return [...localActivities].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  getByEntity(entityType: string, entityId: string): Activity[] {
    return localActivities
      .filter((a) => a.entityType === entityType && a.entityId === entityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  getByType(type: ActivityType): Activity[] {
    return localActivities
      .filter((a) => a.type === type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  getRecent(limit = 10): Activity[] {
    return this.getAll().slice(0, limit);
  },

  log(entityType: string, entityId: string, type: ActivityType, description: string, metadata?: Record<string, unknown>): Activity {
    const activity: Activity = {
      id: `act-${generateId().slice(0, 8)}`,
      entityType,
      entityId,
      type,
      description,
      metadata,
      timestamp: new Date().toISOString(),
    };
    localActivities.unshift(activity);
    return activity;
  },
};
