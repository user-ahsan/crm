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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMeetings(store.meetings);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const getById = useCallback(async (id: string) => {
    try {
      return await meetingService.getById(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load meeting');
      return undefined;
    }
  }, []);

  const getByEntity = useCallback(async (entityType: string, entityId: string) => {
    try {
      return await meetingService.getByEntity(entityType, entityId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load meetings');
      return [];
    }
  }, []);

  // Documented alias (HOOKS.md:154) of getByEntity.
  const getMeetingsForEntity = useCallback(async (entityType: string, entityId: string) => {
    return getByEntity(entityType, entityId);
  }, [getByEntity]);

  const getUpcoming = useCallback(async (limit = 5) => {
    try {
      return await meetingService.getUpcoming(limit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load meetings');
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
    // Capture the pre-mutation row OUTSIDE the state updater so rollback can
    // restore the exact object at its original index (ARCHITECTURE §10).
    const prevItem = meetings.find((m) => m.id === id);
    if (!prevItem) return undefined;
    const prevIndex = meetings.indexOf(prevItem);
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
    try {
      const updated = await meetingService.update(id, data);
      if (!updated) {
        // PGRST116 not-found: revert the optimistic change and surface it.
        setMeetings((prev) => {
          const next = prev.filter((m) => m.id !== id);
          next.splice(Math.min(prevIndex, next.length), 0, prevItem);
          return next;
        });
        setError('Failed to update meeting: record not found');
        return undefined;
      }
      setMeetings((prev) => prev.map((m) => (m.id === id ? updated : m)));
      useEntityCache.getState().updateMeeting(id, updated);
      return updated;
    } catch (e) {
      setMeetings((prev) => {
        const next = prev.filter((m) => m.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to update meeting');
      return undefined;
    }
  }, [meetings]);

  const deleteMeeting = useCallback(async (id: string) => {
    const prevItem = meetings.find((m) => m.id === id);
    if (!prevItem) return false;
    const prevIndex = meetings.indexOf(prevItem);
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    try {
      await meetingService.delete(id);
      useEntityCache.getState().removeMeeting(id);
      return true;
    } catch (e) {
      setMeetings((prev) => {
        const next = prev.filter((m) => m.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to delete meeting');
      return false;
    }
  }, [meetings]);

  return { meetings, loading, error, refresh, getById, getByEntity, getMeetingsForEntity, getUpcoming, createMeeting, updateMeeting, deleteMeeting };
}
