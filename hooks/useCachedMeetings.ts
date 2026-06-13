'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEntityCache } from '@/store/entity-cache';
import { meetingService } from '@/services/meeting.service';
import type { Meeting, MeetingFormData } from '@/types/meeting.types';

export function useCachedMeetings() {
  const meetings = useEntityCache((s) => s.meetings);
  const setMeetings = useEntityCache((s) => s.setMeetings);
  const updateMeeting = useEntityCache((s) => s.updateMeeting);
  const removeMeeting = useEntityCache((s) => s.removeMeeting);
  const [loading, setLoading] = useState(meetings.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refreshFromServer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await meetingService.getAll();
      setMeetings(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [setMeetings]);

  useEffect(() => {
    if (meetings.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await meetingService.getAll();
        if (!cancelled) setMeetings(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load meetings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [meetings.length, setMeetings]);

  const getByEntity = useCallback(async (entityType: string, entityId: string) => {
    try {
      return await meetingService.getByEntity(entityType, entityId);
    } catch {
      return [];
    }
  }, []);

  const getUpcoming = useCallback(async (limit = 5) => {
    try {
      return await meetingService.getUpcoming(limit);
    } catch {
      return [];
    }
  }, []);

  const createMeeting = useCallback(async (data: MeetingFormData) => {
    try {
      const created = await meetingService.create(data);
      const { meetings: cached, setMeetings: setCache } = useEntityCache.getState();
      setCache([created, ...cached]);
      return created;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create meeting');
      return undefined;
    }
  }, []);

  const updateCachedMeeting = useCallback(async (id: string, data: Partial<MeetingFormData & { outcome: string }>) => {
    try {
      const updated = await meetingService.update(id, data);
      if (updated) updateMeeting(id, updated);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update meeting');
      return undefined;
    }
  }, [updateMeeting]);

  const deleteCachedMeeting = useCallback(async (id: string) => {
    try {
      const success = await meetingService.delete(id);
      if (success) removeMeeting(id);
      return success;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete meeting');
      return false;
    }
  }, [removeMeeting]);

  return {
    meetings,
    loading,
    error,
    refreshFromServer,
    getByEntity, getUpcoming,
    createMeeting,
    updateMeeting: updateCachedMeeting,
    deleteMeeting: deleteCachedMeeting,
  };
}
