import { createClient } from '@/lib/supabase/client';
import type { Email, EmailFormData, CallLog, CallLogFormData, Note, NoteFormData } from '@/types/communication.types';
import type { DbEmailHistory, DbCallLog, DbNote } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';
import { activityService } from './activity.service';

let _client: Awaited<ReturnType<typeof createClient>> | null = null;
async function getClient() {
  if (!_client) _client = await createClient();
  return _client;
}

function mapRowToEmail(row: DbEmailHistory): Email {
  return {
    id: row.id,
    fromAddress: row.from_address,
    toAddress: row.to_address,
    subject: row.subject,
    body: row.body,
    direction: row.direction as Email['direction'],
    status: row.status as Email['status'],
    relatedToType: row.related_to_type ?? undefined,
    relatedToId: row.related_to_id ?? undefined,
    sentAt: row.sent_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapEmailToDb(data: EmailFormData & { fromAddress: string; direction: Email['direction']; status: Email['status'] }): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  db.from_address = data.fromAddress;
  db.to_address = data.toAddress;
  db.subject = data.subject;
  db.body = data.body;
  db.direction = data.direction;
  db.status = data.status;
  if (data.relatedToType !== undefined) db.related_to_type = data.relatedToType || null;
  if (data.relatedToId !== undefined) db.related_to_id = data.relatedToId || null;
  if (data.direction === 'outbound' && data.status === 'sent') {
    db.sent_at = new Date().toISOString();
  }
  return db;
}

function mapRowToCallLog(row: DbCallLog): CallLog {
  return {
    id: row.id,
    direction: row.direction,
    duration: row.duration,
    caller: row.caller,
    callee: row.callee,
    notes: row.notes,
    callResult: row.call_result,
    relatedToType: row.related_to_type ?? undefined,
    relatedToId: row.related_to_id ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapFormToDb(data: CallLogFormData & { createdBy: string }): Record<string, unknown> {
  const db: Record<string, unknown> = {
    direction: data.direction,
    caller: data.caller,
    callee: data.callee,
    created_by: data.createdBy,
  };
  if (data.duration !== undefined) db.duration = data.duration;
  if (data.notes !== undefined) db.notes = data.notes || '';
  if (data.callResult !== undefined) db.call_result = data.callResult;
  if (data.relatedToType !== undefined) db.related_to_type = data.relatedToType || null;
  if (data.relatedToId !== undefined) db.related_to_id = data.relatedToId || null;
  return db;
}

function mapRowToNote(row: DbNote): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    relatedToType: row.related_to_type ?? undefined,
    relatedToId: row.related_to_id ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNoteToDb(data: Partial<NoteFormData>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (data.title !== undefined) db.title = data.title;
  if (data.body !== undefined) db.body = data.body;
  if (data.relatedToType !== undefined) db.related_to_type = data.relatedToType || null;
  if (data.relatedToId !== undefined) db.related_to_id = data.relatedToId || null;
  return db;
}

export const communicationService = {
  async getCallLogs(relatedToType?: string, relatedToId?: string): Promise<CallLog[]> {
    try {
      const supabase = await getClient();
      let query = supabase
        .from('call_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (relatedToType && relatedToId) {
        query = query
          .eq('related_to_type', relatedToType)
          .eq('related_to_id', relatedToId);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data?.map(mapRowToCallLog) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async logCall(data: CallLogFormData): Promise<CallLog> {
    try {
      const supabase = await getClient();
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData?.user?.id ?? 'system';
      const dbRow = {
        ...mapFormToDb({ ...data, createdBy }),
        call_result: data.callResult ?? 'completed',
        duration: data.duration ?? 0,
      };
      const { data: inserted, error } = await supabase
        .from('call_logs')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapRowToCallLog(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getNotes(relatedToType?: string, relatedToId?: string): Promise<Note[]> {
    try {
      const supabase = await getClient();
      let query = supabase.from('notes').select('*').order('created_at', { ascending: false });
      if (relatedToType) query = query.eq('related_to_type', relatedToType);
      if (relatedToId) query = query.eq('related_to_id', relatedToId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data?.map(mapRowToNote) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getNote(id: string): Promise<Note | undefined> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapRowToNote(data) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async createNote(data: NoteFormData & { createdBy: string }): Promise<Note> {
    try {
      const supabase = await getClient();
      const dbRow = {
        ...mapNoteToDb(data),
        created_by: data.createdBy,
      };
      const { data: inserted, error } = await supabase
        .from('notes')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapRowToNote(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async updateNote(id: string, data: Partial<NoteFormData>): Promise<Note | undefined> {
    try {
      const supabase = await getClient();
      const dbData = { ...mapNoteToDb(data) };
      const { data: updated, error } = await supabase
        .from('notes')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return updated ? mapRowToNote(updated) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async deleteNote(id: string): Promise<boolean> {
    try {
      const supabase = await getClient();
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  // ── Email methods ──────────────────────────────

  async getEmails(relatedToType?: string, relatedToId?: string): Promise<Email[]> {
    try {
      const supabase = await getClient();
      let query = supabase.from('email_history').select('*');
      if (relatedToType) query = query.eq('related_to_type', relatedToType);
      if (relatedToId) query = query.eq('related_to_id', relatedToId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data?.map(mapRowToEmail) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async sendEmail(data: EmailFormData): Promise<Email> {
    try {
      const supabase = await getClient();
      const dbRow = {
        ...mapEmailToDb({ ...data, fromAddress: 'crm@example.com', direction: 'outbound', status: 'sent' }),
      };
      const { data: inserted, error } = await supabase
        .from('email_history')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const email = mapRowToEmail(inserted);
      if (data.relatedToType && data.relatedToId) {
        activityService.log(
          data.relatedToType,
          data.relatedToId,
          'communication_logged',
          `Email sent to ${data.toAddress}: ${data.subject}`,
          { direction: 'outbound', to: data.toAddress },
        );
      }
      return email;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async saveDraft(data: EmailFormData): Promise<Email> {
    try {
      const supabase = await getClient();
      const dbRow = {
        ...mapEmailToDb({ ...data, fromAddress: 'crm@example.com', direction: 'outbound', status: 'draft' }),
      };
      const { data: inserted, error } = await supabase
        .from('email_history')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapRowToEmail(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getEmailHistory(entityType: string, entityId: string): Promise<Email[]> {
    return this.getEmails(entityType, entityId);
  },
};
