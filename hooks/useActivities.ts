'use client';

import { useState, useCallback } from 'react';
import type { Activity, ActivityType } from '@/types/activity.types';
import { activityService } from '@/services/activity.service';

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      setActivities(activityService.getAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, []);

  const getByEntity = useCallback((entityType: string, entityId: string) => {
    try {
      return activityService.getByEntity(entityType, entityId);
    } catch {
      return [];
    }
  }, []);

  const logActivity = useCallback((entityType: string, entityId: string, type: ActivityType, description: string, metadata?: Record<string, unknown>) => {
    try {
      const activity = activityService.log(entityType, entityId, type, description, metadata);
      setActivities((prev) => [activity, ...prev]);
      return activity;
    } catch {
      return undefined;
    }
  }, []);

  return { activities, loading, error, refresh, getByEntity, logActivity };
}
