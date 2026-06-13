import { getSharedClient } from '@/lib/supabase/client';
import type { Activity, ActivityType } from '@/types/activity.types';
import type { DbActivity } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';
import { triggerWebhook } from './webhook.service';

function mapRowToActivity(row: DbActivity): Activity {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    type: row.type as ActivityType,
    description: row.description,
    metadata: row.metadata ?? undefined,
    timestamp: row.timestamp,
  };
}

export const activityService = {
  async getAll(page = 1, pageSize = 50): Promise<Activity[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToActivity) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getByEntity(entityType: string, entityId: string): Promise<Activity[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('timestamp', { ascending: false });
      if (error) throw new Error(error.message);
      return data?.map(mapRowToActivity) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getByType(type: ActivityType): Promise<Activity[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('type', type)
        .order('timestamp', { ascending: false });
      if (error) throw new Error(error.message);
      return data?.map(mapRowToActivity) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getRecent(limit = 20): Promise<Activity[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(0, limit - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToActivity) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async log(
    entityType: string,
    entityId: string,
    type: ActivityType,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<Activity> {
    const timestamp = new Date().toISOString();
    try {
      const supabase = await getSharedClient();
      const dbRow = {
        entity_type: entityType,
        entity_id: entityId,
        type,
        description,
        metadata: metadata ?? null,
        timestamp,
      };
      const { data: inserted, error } = await supabase
        .from('activities')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const activity = mapRowToActivity(inserted);
      triggerWebhook('activity.created', {
        id: activity.id,
        entityType: activity.entityType,
        entityId: activity.entityId,
        type: activity.type,
        description: activity.description,
      });
      return activity;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
