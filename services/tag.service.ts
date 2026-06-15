import { getSharedClient } from '@/lib/supabase/client';
import type { Tag } from '@/types/tag.types';
import type { DbTag } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

function mapTag(row: DbTag): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export const tagService = {
  async getAll(): Promise<Tag[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return data?.map(mapTag) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getById(id: string): Promise<Tag | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapTag(data) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async create(name: string, color?: string): Promise<Tag> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('tags')
        .insert({ name, color: color ?? '#6366f1' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapTag(data);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async update(id: string, updates: { name?: string; color?: string }): Promise<Tag | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapTag(data) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getTagsForEntity(entityType: string, entityId: string): Promise<Tag[]> {
    try {
      const supabase = await getSharedClient();
      const { data: taggings, error: tgError } = await supabase
        .from('taggings')
        .select('tag_id')
        .eq('taggable_type', entityType)
        .eq('taggable_id', entityId);
      if (tgError) throw new Error(tgError.message);
      if (!taggings || taggings.length === 0) return [];

      const tagIds = taggings.map((t: { tag_id: string }) => t.tag_id);
      const { data: tags, error: tError } = await supabase
        .from('tags')
        .select('*')
        .in('id', tagIds)
        .order('name', { ascending: true });
      if (tError) throw new Error(tError.message);
      return tags?.map(mapTag) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async addTagToEntity(entityType: string, entityId: string, tagId: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase
        .from('taggings')
        .insert({ tag_id: tagId, taggable_id: entityId, taggable_type: entityType });
      if (error) {
        if (error.code === '23505') return true;
        throw new Error(error.message);
      }
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async removeTagFromEntity(entityType: string, entityId: string, tagId: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase
        .from('taggings')
        .delete()
        .eq('tag_id', tagId)
        .eq('taggable_id', entityId)
        .eq('taggable_type', entityType);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async setTagsForEntity(entityType: string, entityId: string, tagIds: string[]): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const existing = await supabase
        .from('taggings')
        .select('tag_id')
        .eq('taggable_type', entityType)
        .eq('taggable_id', entityId);
      const existingIds = existing.data?.map((t: { tag_id: string }) => t.tag_id) ?? [];

      const toAdd = tagIds.filter((id: string) => !existingIds.includes(id));
      const toRemove = existingIds.filter((id: string) => !tagIds.includes(id));

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from('taggings')
          .delete()
          .eq('taggable_type', entityType)
          .eq('taggable_id', entityId)
          .in('tag_id', toRemove);
        if (delErr) throw new Error(delErr.message);
      }

      if (toAdd.length > 0) {
        const inserts = toAdd.map((tagId) => ({
          tag_id: tagId,
          taggable_id: entityId,
          taggable_type: entityType,
        }));
        const { error: insErr } = await supabase.from('taggings').insert(inserts);
        if (insErr) throw new Error(insErr.message);
      }

      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getUsageCounts(): Promise<Record<string, number>> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('taggings')
        .select('tag_id');
      if (error) throw new Error(error.message);
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.tag_id] = (counts[row.tag_id] ?? 0) + 1;
      }
      return counts;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
