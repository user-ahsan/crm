import { getSharedClient } from '@/lib/supabase/client';
import type { Tag } from '@/types/tag.types';
import type { DbTag } from '@/types/supabase.types';
import { toServiceError } from './supabase.service';

// Inline types for Supabase join and aggregate query results
type TaggingJoinRow = { tag: DbTag | null };
type UsageCountRow = { tag_id: string; count: number };

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
      if (error) throw toServiceError(error);
      return data?.map(mapTag) ?? [];
    } catch (e) {
      throw toServiceError(e);
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
        throw toServiceError(error);
      }
      return data ? mapTag(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
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
      if (error) throw toServiceError(error);
      return mapTag(data);
    } catch (e) {
      throw toServiceError(e);
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
        throw toServiceError(error);
      }
      return data ? mapTag(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      // Delete associated taggings first with error checking
      const { error: tgErr } = await supabase.from('taggings').delete().eq('tag_id', id);
      if (tgErr) {
        console.error(`Delete taggings error for tag ${id}: ${tgErr.message}`);
        throw toServiceError(tgErr);
      }
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getTagsForEntity(entityType: string, entityId: string): Promise<Tag[]> {
    try {
      const supabase = await getSharedClient();
      // Use join query instead of two separate queries
      const { data, error } = await supabase
        .from('taggings')
        .select('tag:tag_id(id, name, color, created_at)')
        .eq('taggable_type', entityType)
        .eq('taggable_id', entityId);

      if (error) throw toServiceError(error);
      if (!data || data.length === 0) return [];

      const tags = (data as unknown as TaggingJoinRow[])
        .map((row) => row.tag)
        .filter((t): t is DbTag => t !== null)
        .map(mapTag);
      return tags;
    } catch (e) {
      throw toServiceError(e);
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
        throw toServiceError(error);
      }
      return true;
    } catch (e) {
      throw toServiceError(e);
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
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
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
        if (delErr) throw toServiceError(delErr);
      }

      if (toAdd.length > 0) {
        const inserts = toAdd.map((tagId) => ({
          tag_id: tagId,
          taggable_id: entityId,
          taggable_type: entityType,
        }));
        const { error: insErr } = await supabase.from('taggings').insert(inserts);
        if (insErr) throw toServiceError(insErr);
      }

      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getUsageCounts(): Promise<Record<string, number>> {
    try {
      const supabase = await getSharedClient();
      // Use SQL GROUP BY via aggregate query
      const { data, error } = await supabase
        .from('taggings')
        .select('tag_id, count:count(*)')
        .order('tag_id');

      if (error) throw toServiceError(error);
      const counts: Record<string, number> = {};
      for (const row of (data as unknown as UsageCountRow[]) ?? []) {
        counts[row.tag_id] = Number(row.count);
      }
      return counts;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
