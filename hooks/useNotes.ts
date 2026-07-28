'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Note, NoteFormData } from '@/types/communication.types';
import { generateId } from '@/lib/formatters';
import { communicationService } from '@/services/communication.service';

export function useNotes(entityType?: string, entityId?: string) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await communicationService.getNotes(entityType, entityId);
      setNotes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    let cancelled = false;
    communicationService.getNotes(entityType, entityId)
      .then((data) => {
        if (!cancelled) setNotes(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load notes');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  const createNote = useCallback(async (data: NoteFormData & { createdBy: string }) => {
    const tempId = generateId();
    const optimisticItem: Note = {
      id: tempId,
      title: data.title ?? '',
      body: data.body,
      relatedToType: data.relatedToType,
      relatedToId: data.relatedToId,
      createdBy: data.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [optimisticItem, ...prev]);
    try {
      const created = await communicationService.createNote(data);
      setNotes((prev) => prev.map((n) => (n.id === tempId ? created : n)));
      return created;
    } catch (e) {
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create note');
      return undefined;
    }
  }, []);

  const updateNote = useCallback(async (id: string, data: Partial<NoteFormData>) => {
    let prevItem: Note | undefined;
    setNotes((prev) => {
      prevItem = prev.find((n) => n.id === id);
      return prev.map((n) => (n.id === id ? { ...n, ...data } : n));
    });
    try {
      const updated = await communicationService.updateNote(id, data);
      if (updated) {
        setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      }
      return updated;
    } catch (e) {
      if (prevItem) setNotes((prev) => prev.map((n) => (n.id === id ? prevItem! : n)));
      setError(e instanceof Error ? e.message : 'Failed to update note');
      return undefined;
    }
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    let prevItem: Note | undefined;
    setNotes((prev) => {
      prevItem = prev.find((n) => n.id === id);
      return prev.filter((n) => n.id !== id);
    });
    try {
      await communicationService.deleteNote(id);
      return true;
    } catch (e) {
      if (prevItem) setNotes((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete note');
      return false;
    }
  }, []);

  return {
    notes,
    loading,
    error,
    refresh,
    createNote,
    updateNote,
    deleteNote,
  };
}
