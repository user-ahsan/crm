'use client';

import { useState, useCallback, useEffect } from 'react';
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

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      await refresh();
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refresh]);

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
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: Activity = {
      id: tempId,
      entityType,
      entityId,
      type,
      description,
      metadata,
      timestamp: new Date().toISOString(),
    };
    setActivities((prev) => [optimisticItem, ...prev]);
    try {
      const activity = await activityService.log(entityType, entityId, type, description, metadata);
      setActivities((prev) => prev.map((a) => (a.id === tempId ? activity : a)));
      return activity;
    } catch (e) {
      setActivities((prev) => prev.filter((a) => a.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to log activity');
      return undefined;
    }
  }, []);

  return { activities, loading, error, refresh, getByEntity, logActivity };
}
