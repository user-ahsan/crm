'use client';

import { useState, useCallback } from 'react';
import type { Activity, ActivityType } from '@/types/activity.types';
import { activityService } from '@/services/activity.service';

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await activityService.getAll();
      setActivities(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, []);

  const getByEntity = useCallback(async (entityType: string, entityId: string) => {
    try {
      return await activityService.getByEntity(entityType, entityId);
    } catch {
      return [];
    }
  }, []);

  const logActivity = useCallback(async (
    entityType: string,
    entityId: string,
    type: ActivityType,
    description: string,
    metadata?: Record<string, unknown>,
  ) => {
    try {
      const activity = await activityService.log(entityType, entityId, type, description, metadata);
      setActivities((prev) => [activity, ...prev]);
      return activity;
    } catch {
      return undefined;
    }
  }, []);

  return { activities, loading, error, refresh, getByEntity, logActivity };
}
