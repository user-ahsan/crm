import { createClient } from '@/lib/supabase/client';
import type { Meeting, MeetingFormData } from '@/types/meeting.types';
import type { DbMeeting } from '@/types/supabase.types';
import { formatSupabaseError, addLocalActivity } from './supabase.service';

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

function mapMeetingToDb(meeting: Partial<MeetingFormData & { outcome: string }>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
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
  async getAll(): Promise<Meeting[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('date_time', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbMeeting[] | null)?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to fetch meetings');
    }
  },

  async getById(id: string): Promise<Meeting | undefined> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapRowToMeeting(data as DbMeeting) : undefined;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch meeting ${id}`);
    }
  },

  async getByEntity(entityType: string, entityId: string): Promise<Meeting[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('related_to_type', entityType)
        .eq('related_to_id', entityId)
        .order('date_time', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbMeeting[] | null)?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch meetings for ${entityType}/${entityId}`);
    }
  },

  async getByDateRange(start: string, end: string): Promise<Meeting[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('date_time', start)
        .lte('date_time', end)
        .order('date_time', { ascending: true });
      if (error) throw new Error(error.message);
      return (data as DbMeeting[] | null)?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to fetch meetings by date range');
    }
  },

  async getUpcoming(limit = 5): Promise<Meeting[]> {
    try {
      const supabase = await createClient();
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('date_time', now)
        .order('date_time', { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data as DbMeeting[] | null)?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to fetch upcoming meetings');
    }
  },

  async create(data: MeetingFormData): Promise<Meeting> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();
      const dbRow = {
        ...mapMeetingToDb(data),
        created_at: now,
        updated_at: now,
      };
      const { data: inserted, error } = await supabase
        .from('meetings')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const meeting = mapRowToMeeting(inserted as DbMeeting);
      addLocalActivity('meeting', meeting.id, 'meeting_scheduled', `Meeting scheduled: ${meeting.title}`, {
        date: meeting.dateTime,
      });
      if (meeting.relatedToType && meeting.relatedToId) {
        addLocalActivity(meeting.relatedToType, meeting.relatedToId, 'meeting_scheduled', `Meeting scheduled: ${meeting.title}`);
      }
      return meeting;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to create meeting');
    }
  },

  async update(id: string, data: Partial<MeetingFormData & { outcome: string }>): Promise<Meeting | undefined> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();
      const dbData = { ...mapMeetingToDb(data), updated_at: now };
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
      return mapRowToMeeting(updated as DbMeeting);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to update meeting ${id}`);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to delete meeting ${id}`);
    }
  },
};
