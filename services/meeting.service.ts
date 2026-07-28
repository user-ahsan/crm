import { getSharedClient } from '@/lib/supabase/client';
import type { Meeting, MeetingFormData } from '@/types/meeting.types';
import type { DbMeeting, MeetingInsert } from '@/types/supabase.types';
import { asEnum, toServiceError } from './supabase.service';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';

const MEETING_TYPES = ['online', 'offline', 'call', 'video', 'in_person', 'other'] as const;

function mapRowToMeeting(row: DbMeeting): Meeting {
  return {
    id: row.id,
    title: row.title,
    participants: row.participants ?? [],
    relatedToType: (row.related_to_type as Meeting['relatedToType']) ?? undefined,
    relatedToId: row.related_to_id ?? undefined,
    dateTime: row.date_time,
    duration: row.duration,
    type: asEnum(row.type, MEETING_TYPES),
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
      if (error) throw toServiceError(error);
      return data?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw toServiceError(e);
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
        throw toServiceError(error);
      }
      return data ? mapRowToMeeting(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
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
      if (error) throw toServiceError(error);
      return data?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw toServiceError(e);
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
      if (error) throw toServiceError(error);
      return data?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw toServiceError(e);
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
      if (error) throw toServiceError(error);
      return data?.map(mapRowToMeeting) ?? [];
    } catch (e) {
      throw toServiceError(e);
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
      if (error) throw toServiceError(error);
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
      throw toServiceError(e);
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
        throw toServiceError(error);
      }
      const meeting = mapRowToMeeting(updated);
      activityService.log('meeting', id, 'updated', `Meeting "${meeting.title}" updated`, {
        title: meeting.title,
        dateTime: meeting.dateTime,
        type: meeting.type,
        outcome: data.outcome,
      });
      triggerWebhook('meeting.updated', { id, ...data });
      return meeting;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const ops = [
        supabase.from('activities').delete().eq('entity_id', id),
      ];
      const results = await Promise.all(ops);
      for (const r of results) if (r.error) console.error(`Cascade delete error: ${r.error.message}`);
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw toServiceError(error);
      activityService.log('meeting', id, 'deleted', `Meeting deleted`);
      triggerWebhook('meeting.deleted', { id });
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
