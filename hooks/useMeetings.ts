'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Meeting, MeetingFormData } from '@/types/meeting.types';
import { generateId } from '@/lib/formatters';
import { meetingService } from '@/services/meeting.service';
import { useEntityCache, isCacheStale } from '@/store/entity-cache';

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
      const store = useEntityCache.getState();
      store.setMeetings(data);
      store.setLastFetched('meetings');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // P8: Skip fetch if cache is fresh
    const store = useEntityCache.getState();
    if (!isCacheStale(store, 'meetings') && store.meetings.length > 0) {
      setMeetings(store.meetings);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

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
    const tempId = generateId();
    const optimisticItem: Meeting = {
      id: tempId,
      title: data.title,
      participants: data.participants ?? [],
      relatedToType: data.relatedToType,
      relatedToId: data.relatedToId,
      dateTime: data.dateTime,
      duration: data.duration,
      type: data.type,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMeetings((prev) => [optimisticItem, ...prev]);
    try {
      const created = await meetingService.create(data);
      setMeetings((prev) => prev.map((m) => (m.id === tempId ? created : m)));
      const { meetings: cached, setMeetings: setCache } = useEntityCache.getState();
      setCache([created, ...cached]);
      return created;
    } catch (e) {
      setMeetings((prev) => prev.filter((m) => m.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create meeting');
      return undefined;
    }
  }, []);

  const updateMeeting = useCallback(async (id: string, data: Partial<MeetingFormData & { outcome: string }>) => {
    let prevItem: Meeting | undefined;
    setMeetings((prev) => {
      prevItem = prev.find((m) => m.id === id);
      return prev.map((m) => (m.id === id ? { ...m, ...data } : m));
    });
    try {
      const updated = await meetingService.update(id, data);
      if (updated) {
        setMeetings((prev) => prev.map((m) => (m.id === id ? updated : m)));
        useEntityCache.getState().updateMeeting(id, updated);
      }
      return updated;
    } catch (e) {
      if (prevItem) setMeetings((prev) => prev.map((m) => (m.id === id ? prevItem! : m)));
      setError(e instanceof Error ? e.message : 'Failed to update meeting');
      return undefined;
    }
  }, []);

  const deleteMeeting = useCallback(async (id: string) => {
    let prevItem: Meeting | undefined;
    setMeetings((prev) => {
      prevItem = prev.find((m) => m.id === id);
      return prev.filter((m) => m.id !== id);
    });
    try {
      await meetingService.delete(id);
      useEntityCache.getState().removeMeeting(id);
      return true;
    } catch (e) {
      if (prevItem) setMeetings((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete meeting');
      return false;
    }
  }, []);

  return { meetings, loading, error, refresh, getByEntity, getUpcoming, createMeeting, updateMeeting, deleteMeeting };
}
