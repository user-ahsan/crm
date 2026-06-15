'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Tag } from '@/types/tag.types';
import { tagService } from '@/services/tag.service';

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tagService.getAll();
      setTags(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await tagService.getAll();
        if (!cancelled) setTags(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load tags');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const createTag = useCallback(async (name: string, color?: string) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: Tag = { id: tempId, name, color: color ?? '#6366f1', createdAt: new Date().toISOString() };
    setTags((prev) => [optimisticItem, ...prev]);
    try {
      const created = await tagService.create(name, color);
      setTags((prev) => prev.map((t) => (t.id === tempId ? created : t)));
      return created;
    } catch (e) {
      setTags((prev) => prev.filter((t) => t.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create tag');
      return undefined;
    }
  }, []);

  const updateTag = useCallback(async (id: string, updates: { name?: string; color?: string }) => {
    const previous = tags;
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    try {
      const updated = await tagService.update(id, updates);
      if (updated) {
        setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
      }
      return updated;
    } catch (e) {
      setTags(previous);
      setError(e instanceof Error ? e.message : 'Failed to update tag');
      return undefined;
    }
  }, [tags]);

  const deleteTag = useCallback(async (id: string) => {
    const previous = tags;
    setTags((prev) => prev.filter((t) => t.id !== id));
    try {
      await tagService.delete(id);
      return true;
    } catch (e) {
      setTags(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete tag');
      return false;
    }
  }, [tags]);

  const getEntityTags = useCallback(async (entityType: string, entityId: string) => {
    try {
      return await tagService.getTagsForEntity(entityType, entityId);
    } catch {
      return [];
    }
  }, []);

  const addEntityTag = useCallback(async (entityType: string, entityId: string, tagId: string) => {
    try {
      return await tagService.addTagToEntity(entityType, entityId, tagId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add tag');
      return false;
    }
  }, []);

  const removeEntityTag = useCallback(async (entityType: string, entityId: string, tagId: string) => {
    try {
      return await tagService.removeTagFromEntity(entityType, entityId, tagId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove tag');
      return false;
    }
  }, []);

  return {
    tags, loading, error, refresh,
    createTag, updateTag, deleteTag,
    getEntityTags, addEntityTag, removeEntityTag,
  };
}
