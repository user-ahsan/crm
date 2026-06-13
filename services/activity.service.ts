import { activities as mockActivities } from '@/data/activities';
import type { Activity, ActivityType } from '@/types/activity.types';
import type { DbActivity } from '@/types/supabase.types';
import { generateId } from '@/lib/formatters';
import { isSupabaseConfigured, getSupabaseClient as getSupabaseClientAsync, formatSupabaseError } from './supabase.service';

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
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbActivity[] | null)?.map(mapRowToActivity) ?? [];
    }
    return [...mockActivities].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  },

  async getByEntity(entityType: string, entityId: string): Promise<Activity[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('timestamp', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbActivity[] | null)?.map(mapRowToActivity) ?? [];
    }
    return mockActivities
      .filter((a) => a.entityType === entityType && a.entityId === entityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  async getByType(type: ActivityType): Promise<Activity[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('type', type)
        .order('timestamp', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbActivity[] | null)?.map(mapRowToActivity) ?? [];
    }
    return mockActivities
      .filter((a) => a.type === type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  async getRecent(limit = 10): Promise<Activity[]> {
    const all = await this.getAll();
    return all.slice(0, limit);
  },

  async log(
    entityType: string,
    entityId: string,
    type: ActivityType,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<Activity> {
    const timestamp = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const dbRow = {
        id: crypto.randomUUID(),
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
      if (error) throw new Error(formatSupabaseError(error));
      return mapRowToActivity(inserted as DbActivity);
    }
    const activity: Activity = {
      id: `act-${generateId().slice(0, 8)}`,
      entityType,
      entityId,
      type,
      description,
      metadata,
      timestamp,
    };
    mockActivities.unshift(activity);
    return activity;
  },
};
