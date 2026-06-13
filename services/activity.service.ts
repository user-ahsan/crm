import { createClient } from '@/lib/supabase/client';
import type { Activity, ActivityType } from '@/types/activity.types';
import type { DbActivity } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

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
  async getAll(): Promise<Activity[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbActivity[] | null)?.map(mapRowToActivity) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to fetch activities');
    }
  },

  async getByEntity(entityType: string, entityId: string): Promise<Activity[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('timestamp', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbActivity[] | null)?.map(mapRowToActivity) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch activities for ${entityType}/${entityId}`);
    }
  },

  async getByType(type: ActivityType): Promise<Activity[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('type', type)
        .order('timestamp', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbActivity[] | null)?.map(mapRowToActivity) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch activities of type ${type}`);
    }
  },

  async getRecent(limit = 10): Promise<Activity[]> {
    try {
      const all = await this.getAll();
      return all.slice(0, limit);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to fetch recent activities');
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
      const supabase = await createClient();
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
      return mapRowToActivity(inserted as DbActivity);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to log activity');
    }
  },
};
