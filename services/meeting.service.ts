import { meetings as mockMeetings } from '@/data/meetings';
import type { Meeting, MeetingFormData } from '@/types/meeting.types';
import type { DbMeeting } from '@/types/supabase.types';
import { generateId } from '@/lib/formatters';
import { isSupabaseConfigured, getSupabaseClient as getSupabaseClientAsync, formatSupabaseError, addLocalActivity } from './supabase.service';

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
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('date_time', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbMeeting[] | null)?.map(mapRowToMeeting) ?? [];
    }
    return [...mockMeetings];
  },

  async getById(id: string): Promise<Meeting | undefined> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(formatSupabaseError(error));
      }
      return data ? mapRowToMeeting(data as DbMeeting) : undefined;
    }
    return mockMeetings.find((m) => m.id === id);
  },

  async getByEntity(entityType: string, entityId: string): Promise<Meeting[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('related_to_type', entityType)
        .eq('related_to_id', entityId)
        .order('date_time', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbMeeting[] | null)?.map(mapRowToMeeting) ?? [];
    }
    return mockMeetings.filter((m) => m.relatedToType === entityType && m.relatedToId === entityId);
  },

  async getByDateRange(start: string, end: string): Promise<Meeting[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('date_time', start)
        .lte('date_time', end)
        .order('date_time', { ascending: true });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbMeeting[] | null)?.map(mapRowToMeeting) ?? [];
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    return mockMeetings.filter((m) => {
      const meetingDate = new Date(m.dateTime);
      return meetingDate >= startDate && meetingDate <= endDate;
    });
  },

  async getUpcoming(limit = 5): Promise<Meeting[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('date_time', now)
        .order('date_time', { ascending: true })
        .limit(limit);
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbMeeting[] | null)?.map(mapRowToMeeting) ?? [];
    }
    const now = new Date();
    const upcoming = mockMeetings
      .filter((m) => new Date(m.dateTime) >= now)
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    return upcoming.slice(0, limit);
  },

  async create(data: MeetingFormData): Promise<Meeting> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const dbRow = {
        ...mapMeetingToDb(data),
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      };
      const { data: inserted, error } = await supabase
        .from('meetings')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(formatSupabaseError(error));
      const meeting = mapRowToMeeting(inserted as DbMeeting);
      addLocalActivity('meeting', meeting.id, 'meeting_scheduled', `Meeting scheduled: ${meeting.title}`, {
        date: meeting.dateTime,
      });
      if (meeting.relatedToType && meeting.relatedToId) {
        addLocalActivity(meeting.relatedToType, meeting.relatedToId, 'meeting_scheduled', `Meeting scheduled: ${meeting.title}`);
      }
      return meeting;
    }
    const newMeeting: Meeting = {
      ...data,
      id: `meeting-${generateId().slice(0, 8)}`,
      participants: data.participants || [],
      createdAt: now,
      updatedAt: now,
    };
    mockMeetings.unshift(newMeeting);

    addLocalActivity('meeting', newMeeting.id, 'meeting_scheduled', `Meeting scheduled: ${newMeeting.title}`, {
      date: data.dateTime,
    });

    if (data.relatedToType && data.relatedToId) {
      addLocalActivity(data.relatedToType, data.relatedToId, 'meeting_scheduled', `Meeting scheduled: ${newMeeting.title}`);
    }

    return newMeeting;
  },

  async update(id: string, data: Partial<MeetingFormData & { outcome: string }>): Promise<Meeting | undefined> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const dbData = { ...mapMeetingToDb(data), updated_at: now };
      const { data: updated, error } = await supabase
        .from('meetings')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(formatSupabaseError(error));
      }
      return mapRowToMeeting(updated as DbMeeting);
    }
    const index = mockMeetings.findIndex((m) => m.id === id);
    if (index === -1) return undefined;
    const updated = {
      ...mockMeetings[index],
      ...data,
      participants: data.participants ?? mockMeetings[index].participants,
      updatedAt: now,
    };
    mockMeetings[index] = updated;
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw new Error(formatSupabaseError(error));
      return true;
    }
    const index = mockMeetings.findIndex((m) => m.id === id);
    if (index === -1) return false;
    mockMeetings.splice(index, 1);
    return true;
  },
};
