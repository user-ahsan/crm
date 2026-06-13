import { getSharedClient } from '@/lib/supabase/client';
import type { Meeting, MeetingFormData } from '@/types/meeting.types';
import type { DbMeeting, MeetingInsert } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';

function mapRowToMeeting(row: DbMeeting): Meeting {
  return {
    id: row.id,
    title: row.title,
    participants: row.participants ?? [],
    relatedToType: row.related_to_type ?? undefined,
    relatedToId: row.related_to_id ?? undefined,
    dateTime: row.date_time,
    duration: row.duration,
    type: row.type as Meeting['type'],
    notes: row.notes ?? undefined,
    outcome: row.outcome ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMeetingToDb(meeting: Partial<MeetingFormData & { outcome: string }>): Partial<MeetingInsert> {
  const db: Partial<MeetingInsert> = {};
  if (meeting.title !== undefined) db.title = meeting.title;
  if (meeting.participants !== undefined) db.participants = meeting.participants;
  if (meeting.relatedToType !== undefined) db.related_to_type = meeting.relatedToType || null;
  if (meeting.relatedToId !== undefined) db.related_to_id = meeting.relatedToId || null;
  if (meeting.dateTime !== undefined) db.date_time = meeting.dateTime;
  if (meeting.duration !== undefined) db.duration = meeting.duration;
  if (meeting.type !== undefined) db.type = meeting.type;
  if (meeting.notes !== undefined) db.notes = meeting.notes || null;
  if (meeting.outcome !== undefined) db.outcome = meeting.outcome || null;
  return db;
}

export const meetingService = {
  async getAll(page = 1, pageSize = 50): Promise<Meeting[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('date_time', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getById(id: string): Promise<Meeting | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapRowToMeeting(data) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getByEntity(entityType: string, entityId: string, page = 1, pageSize = 50): Promise<Meeting[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('related_to_type', entityType)
        .eq('related_to_id', entityId)
        .order('date_time', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getByDateRange(start: string, end: string, page = 1, pageSize = 50): Promise<Meeting[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('date_time', start)
        .lte('date_time', end)
        .order('date_time', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getUpcoming(limit = 5): Promise<Meeting[]> {
    try {
      const supabase = await getSharedClient();
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('date_time', now)
        .order('date_time', { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async create(data: MeetingFormData): Promise<Meeting> {
    try {
      const supabase = await getSharedClient();
      const dbRow = {
        ...mapMeetingToDb(data),
      };
      const { data: inserted, error } = await supabase
        .from('meetings')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const meeting = mapRowToMeeting(inserted);
      activityService.log('meeting', meeting.id, 'meeting_scheduled', `Meeting scheduled: ${meeting.title}`, {
        date: meeting.dateTime,
      });
      triggerWebhook('meeting.created', {
        id: meeting.id,
        title: meeting.title,
        dateTime: meeting.dateTime,
        relatedToType: meeting.relatedToType,
        relatedToId: meeting.relatedToId,
      });
      return meeting;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async update(id: string, data: Partial<MeetingFormData & { outcome: string }>): Promise<Meeting | undefined> {
    try {
      const supabase = await getSharedClient();
      const dbData = { ...mapMeetingToDb(data) };
      const { data: updated, error } = await supabase
        .from('meetings')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      const meeting = mapRowToMeeting(updated);
      triggerWebhook('meeting.updated', { id, ...data });
      return meeting;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      await supabase.from('activities').delete().eq('entity_id', id);
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw new Error(error.message);
      activityService.log('meeting', id, 'deleted', `Meeting deleted`);
      triggerWebhook('meeting.deleted', { id });
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
