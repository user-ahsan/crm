'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Meeting, MeetingFormData } from '@/types/meeting.types';
import { meetingService } from '@/services/meeting.service';

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
      const newMeeting = await meetingService.create(data);
      setMeetings((prev) => [newMeeting, ...prev]);
      return newMeeting;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create meeting');
      return undefined;
    }
  }, []);

  const updateMeeting = useCallback(async (id: string, data: Partial<MeetingFormData & { outcome: string }>) => {
    try {
      const updated = await meetingService.update(id, data);
      if (updated) setMeetings((prev) => prev.map((m) => (m.id === id ? updated : m)));
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update meeting');
      return undefined;
    }
  }, []);

  const deleteMeeting = useCallback(async (id: string) => {
    try {
      const success = await meetingService.delete(id);
      if (success) setMeetings((prev) => prev.filter((m) => m.id !== id));
      return success;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete meeting');
      return false;
    }
  }, []);

  return { meetings, loading, error, refresh, getByEntity, getUpcoming, createMeeting, updateMeeting, deleteMeeting };
}
