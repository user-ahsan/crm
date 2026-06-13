'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Meeting, MeetingFormData } from '@/types/meeting.types';
import { meetingService } from '@/services/meeting.service';

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      setMeetings(meetingService.getAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getByEntity = useCallback((entityType: string, entityId: string) => {
    return meetingService.getByEntity(entityType, entityId);
  }, []);

  const getUpcoming = useCallback((limit = 5) => {
    return meetingService.getUpcoming(limit);
  }, []);

  const createMeeting = useCallback((data: MeetingFormData) => {
    try {
      const newMeeting = meetingService.create(data);
      setMeetings((prev) => [newMeeting, ...prev]);
      return newMeeting;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create meeting');
      return undefined;
    }
  }, []);

  const updateMeeting = useCallback((id: string, data: Partial<MeetingFormData & { outcome: string }>) => {
    try {
      const updated = meetingService.update(id, data);
      if (updated) setMeetings((prev) => prev.map((m) => (m.id === id ? updated : m)));
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update meeting');
      return undefined;
    }
  }, []);

  const deleteMeeting = useCallback((id: string) => {
    try {
      const success = meetingService.delete(id);
      if (success) setMeetings((prev) => prev.filter((m) => m.id !== id));
      return success;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete meeting');
      return false;
    }
  }, []);

  return { meetings, loading, error, refresh, getByEntity, getUpcoming, createMeeting, updateMeeting, deleteMeeting };
}
