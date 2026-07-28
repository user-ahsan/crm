import { getSharedClient } from '@/lib/supabase/client';
import { getResendClient, isResendConfigured } from '@/lib/email';
import type { Email, EmailFormData, CallLog, CallLogFormData, Note, NoteFormData } from '@/types/communication.types';
import type { DbEmailHistory, DbCallLog, DbNote, EmailHistoryInsert, CallLogInsert, NoteInsert } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';

/** Safe getter — never throws. Falls back to env or a placeholder so the UI never hard-crashes. */
function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL
    || process.env.NEXT_PUBLIC_DEFAULT_FROM_EMAIL
    || 'noreply@nexuscrm.app';
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
    providerMessageId: row.provider_message_id ?? undefined,
    errorMessage: row.error_message ?? undefined,
  };
}

function mapEmailToDb(data: EmailFormData & { fromAddress: string; direction: Email['direction']; status: Email['status'] }): Partial<EmailHistoryInsert> {
  const db: Partial<EmailHistoryInsert> = {};
  db.from_address = data.fromAddress;
  db.to_address = data.toAddress;
  db.subject = data.subject;
  db.body = data.body;
  db.direction = data.direction;
  db.status = data.status;
  if (data.relatedToType !== undefined) db.related_to_type = data.relatedToType || null;
  if (data.relatedToId !== undefined) db.related_to_id = data.relatedToId || null;
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

function mapFormToDb(data: CallLogFormData & { createdBy: string }): Partial<CallLogInsert> {
  const db: Partial<CallLogInsert> = {
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

function mapNoteToDb(data: Partial<NoteFormData>): Partial<NoteInsert> {
  const db: Partial<NoteInsert> = {};
  if (data.title !== undefined) db.title = data.title;
  if (data.body !== undefined) db.body = data.body;
  if (data.relatedToType !== undefined) db.related_to_type = data.relatedToType || null;
  if (data.relatedToId !== undefined) db.related_to_id = data.relatedToId || null;
  return db;
}

export const communicationService = {
  async getCallLogs(relatedToType?: string, relatedToId?: string): Promise<CallLog[]> {
    try {
      const supabase = await getSharedClient();
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
      if (error) throw toServiceError(error);
      return data?.map(mapRowToCallLog) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async logCall(data: CallLogFormData): Promise<CallLog> {
    try {
      const supabase = await getSharedClient();
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
      if (error) throw toServiceError(error);
      return mapRowToCallLog(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getNotes(relatedToType?: string, relatedToId?: string): Promise<Note[]> {
    try {
      const supabase = await getSharedClient();
      let query = supabase.from('notes').select('*').order('created_at', { ascending: false });
      if (relatedToType) query = query.eq('related_to_type', relatedToType);
      if (relatedToId) query = query.eq('related_to_id', relatedToId);
      const { data, error } = await query;
      if (error) throw toServiceError(error);
      return data?.map(mapRowToNote) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getNote(id: string): Promise<Note | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data ? mapRowToNote(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async createNote(data: NoteFormData & { createdBy: string }): Promise<Note> {
    try {
      const supabase = await getSharedClient();
      const dbRow = {
        ...mapNoteToDb(data),
        created_by: data.createdBy,
      };
      const { data: inserted, error } = await supabase
        .from('notes')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw toServiceError(error);
      return mapRowToNote(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async updateNote(id: string, data: Partial<NoteFormData>): Promise<Note | undefined> {
    try {
      const supabase = await getSharedClient();
      const dbData = { ...mapNoteToDb(data) };
      const { data: updated, error } = await supabase
        .from('notes')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return updated ? mapRowToNote(updated) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async deleteNote(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  // ── Email methods ──────────────────────────────

  async getEmails(relatedToType?: string, relatedToId?: string): Promise<Email[]> {
    try {
      const supabase = await getSharedClient();
      let query = supabase.from('email_history').select('*');
      if (relatedToType) query = query.eq('related_to_type', relatedToType);
      if (relatedToId) query = query.eq('related_to_id', relatedToId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw toServiceError(error);
      return data?.map(mapRowToEmail) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async sendEmail(data: EmailFormData): Promise<Email> {
    // Validate minimum length for subject and body
    if (!data.subject || data.subject.trim().length < 1) {
      throw new ServiceError('Email subject is required', 'VALIDATION_ERROR');
    }
    if (!data.body || data.body.trim().length < 1) {
      throw new ServiceError('Email body is required', 'VALIDATION_ERROR');
    }
    try {
      const supabase = await getSharedClient();
      const fromAddress = getFromAddress();

      // 1. Insert DB record FIRST with status='pending' — no provider_message_id yet
      const dbRow: Partial<EmailHistoryInsert> = {
        ...mapEmailToDb({ ...data, fromAddress, direction: 'outbound', status: 'pending' }),
        sent_at: null,
        error_message: null,
        provider_message_id: null,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('email_history')
        .insert(dbRow)
        .select()
        .single();

      if (insertError) {
        throw toServiceError(insertError);
      }

      // 2. Attempt to send via Resend (only if configured)
      let status: Email['status'] = 'sent';
      let sentAt: string | undefined = new Date().toISOString();
      let providerMessageId: string | undefined;
      let errorMessage: string | undefined;

      if (!isResendConfigured()) {
        // ponytail: no email provider — save as queued so the UI shows a clear signal
        status = 'queued';
        sentAt = undefined;
        errorMessage = 'Email provider not configured. Set RESEND_API_KEY in your environment to send emails.';
      } else {
        try {
          const resend = getResendClient();
          const result = await resend.emails.send({
            from: fromAddress,
            to: data.toAddress,
            subject: data.subject,
            text: data.body,
          });

          if (result.error) {
            const errMsg = typeof result.error === 'object' && result.error !== null && 'message' in result.error
              ? (result.error as { message: string }).message
              : String(result.error);
            throw new Error(errMsg);
          }

          providerMessageId = result.data?.id;
        } catch (sendError) {
          status = 'failed';
          sentAt = undefined;
          errorMessage = sendError instanceof Error ? sendError.message : 'Failed to send email';
        }
      }

      // 3. UPDATE the DB record with result (success/failure + provider_message_id or error)
      const { error: updateError } = await supabase
        .from('email_history')
        .update({
          status,
          sent_at: sentAt ?? null,
          error_message: errorMessage ?? null,
          provider_message_id: providerMessageId ?? null,
        })
        .eq('id', inserted.id);

      if (updateError) {
        console.error(
          `[communication] Failed to update email status for ${inserted.id}: ${updateError.message}`,
        );
      }

      const email = mapRowToEmail({
        ...inserted,
        status,
        sent_at: sentAt ?? null,
        error_message: errorMessage ?? null,
        provider_message_id: providerMessageId ?? null,
      });

      // Activity logging - only log when sent, not on failure
      if (data.relatedToType && data.relatedToId && status === 'sent') {
        activityService.log(
          data.relatedToType,
          data.relatedToId,
          'communication_logged',
          `Email sent to ${data.toAddress}: ${data.subject}`,
          { direction: 'outbound', to: data.toAddress },
        );
      }

      // Webhook trigger (fire-and-forget)
      triggerWebhook('email.sent', {
        id: email.id,
        toAddress: data.toAddress,
        subject: data.subject,
        status,
      });

      return email;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async saveDraft(data: EmailFormData): Promise<Email> {
    try {
      const supabase = await getSharedClient();
      const dbRow = {
        ...mapEmailToDb({ ...data, fromAddress: getFromAddress(), direction: 'outbound', status: 'draft' }),
      };
      const { data: inserted, error } = await supabase
        .from('email_history')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw toServiceError(error);
      return mapRowToEmail(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getEmailHistory(entityType: string, entityId: string): Promise<Email[]> {
    return this.getEmails(entityType, entityId);
  },

  async sendBatchEmails(
    emails: Array<{ toAddress: string; subject: string; body: string; relatedToType?: string; relatedToId?: string }>,
  ): Promise<Array<{ toAddress: string; success: boolean; messageId?: string; error?: string }>> {
    const results: Array<{ toAddress: string; success: boolean; messageId?: string; error?: string }> = [];

    for (const email of emails) {
      try {
        const result = await this.sendEmail({
          toAddress: email.toAddress,
          subject: email.subject,
          body: email.body,
          relatedToType: email.relatedToType,
          relatedToId: email.relatedToId,
        });
        results.push({
          toAddress: email.toAddress,
          success: result.status === 'sent' || result.status === 'queued',
          messageId: result.id,
          error: result.status === 'queued' ? result.errorMessage : undefined,
        });
      } catch (e) {
        // ponytail: one-at-a-time, no parallel blast for MVP
        results.push({
          toAddress: email.toAddress,
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    return results;
  },
};
