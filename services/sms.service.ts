import { getSharedClient } from '@/lib/supabase/client';
import { getServiceConfig } from '@/lib/service-config';
import type { SmsLog, SmsFormData, SmsRelatedEntity, SmsStatus } from '@/types/sms.types';
import type { DbSmsLog, SmsLogUpdate } from '@/types/supabase.types';
import { toServiceError } from './supabase.service';
import { activityService } from './activity.service';

/** Narrowing guard for the polymorphic related-entity union (SmsRelatedEntity). */
export function isSmsRelatedEntity(value: unknown): value is SmsRelatedEntity {
  return value === 'lead' || value === 'contact' || value === 'company' || value === 'deal';
}

/**
 * Maps a Twilio MessageStatus string to the app's SmsStatus union.
 * Intermediate/in-flight states collapse to 'queued'; hard failures collapse
 * to 'failed'. Shared by /api/sms/send and the /api/sms/status callback.
 */
export function mapTwilioMessageStatus(status: string): SmsStatus {
  switch (status) {
    case 'sent':
      return 'sent';
    case 'delivered':
    case 'read':
    case 'partially_delivered':
      return 'delivered';
    case 'failed':
    case 'undelivered':
    case 'canceled':
      return 'failed';
    case 'queued':
    case 'sending':
    case 'accepted':
    case 'scheduled':
    default:
      return 'queued';
  }
}

function mapRowToSms(row: DbSmsLog): SmsLog {
  return {
    id: row.id,
    toNumber: row.to_number,
    fromNumber: row.from_number,
    body: row.body,
    direction: row.direction === 'inbound' || row.direction === 'outbound' ? row.direction : 'outbound',
    status: row.status,
    providerMessageId: row.provider_message_id ?? undefined,
    errorMessage: row.error_message ?? undefined,
    relatedToType: isSmsRelatedEntity(row.related_to_type) ? row.related_to_type : undefined,
    relatedToId: row.related_to_id ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

interface SmsLogInsert {
  to_number: string;
  from_number: string;
  body: string;
  direction: string;
  status: string;
  related_to_type: string | null;
  related_to_id: string | null;
  created_by: string;
}

export const smsService = {
  async getLogs(relatedToType?: string, relatedToId?: string): Promise<SmsLog[]> {
    try {
      const supabase = await getSharedClient();
      let query = supabase
        .from('sms_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (relatedToType && relatedToId) {
        query = query.eq('related_to_type', relatedToType).eq('related_to_id', relatedToId);
      }
      const { data, error } = await query;
      if (error) throw toServiceError(error);
      return data?.map(mapRowToSms) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async send(data: SmsFormData): Promise<SmsLog> {
    // Load config: Supabase (UI-configured) first, env-var fallback
    const smsConfig = await getServiceConfig('sms');
    const fromNumber = data.fromNumber || smsConfig.from_number || process.env.TWILIO_FROM_NUMBER || '+15551234567';
    try {
      const supabase = await getSharedClient();
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData?.user?.id ?? 'system';

      // Guard: if Twilio is not configured, save as 'queued' so the UI shows a clear signal
      const twilioAvailable = !!(smsConfig.account_sid && smsConfig.auth_token);
      const status = twilioAvailable ? 'sent' as const : 'queued' as const;
      const errorMessage = twilioAvailable ? null : 'SMS provider not configured. Add your Twilio credentials in Settings > Services.';

      const dbRow: SmsLogInsert = {
        to_number: data.toNumber,
        from_number: fromNumber,
        body: data.body,
        direction: 'outbound',
        status,
        related_to_type: data.relatedToType ?? null,
        related_to_id: data.relatedToId ?? null,
        created_by: createdBy,
      };

      const { data: inserted, error } = await supabase
        .from('sms_logs')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw toServiceError(error);

      const sms = mapRowToSms(inserted);

      // Only log activity when actually sent to the carrier
      if (data.relatedToType && data.relatedToId && sms.status === 'sent' && twilioAvailable) {
        activityService.log(
          data.relatedToType,
          data.relatedToId,
          'communication_logged',
          `SMS sent to ${data.toNumber}: ${data.body.slice(0, 60)}`,
          { direction: 'outbound', to: data.toNumber },
        );
      }

      // ponytail: actual Twilio API call happens in the API route (/api/sms/send)
      // which calls smsService.send() for DB persistence, then calls Twilio separately.
      // The providerMessageId from Twilio is updated back via updateStatus() in the route.
      return { ...sms, errorMessage: errorMessage ?? undefined };
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Updates a persisted SMS log's delivery status (sent → delivered/failed and
   * provider id / error reconciliation). Used by /api/sms/send after the Twilio
   * call returns and by the /api/sms/status Twilio callback route.
   */
  async updateStatus(
    id: string,
    status: SmsStatus,
    extras?: { providerMessageId?: string; errorMessage?: string },
  ): Promise<SmsLog | undefined> {
    try {
      const supabase = await getSharedClient();
      const update: SmsLogUpdate = { status };
      if (extras?.providerMessageId !== undefined) update.provider_message_id = extras.providerMessageId;
      if (extras?.errorMessage !== undefined) update.error_message = extras.errorMessage;
      const { data, error } = await supabase
        .from('sms_logs')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data ? mapRowToSms(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async sendBatchSms(
    messages: Array<{
      toNumber: string;
      body: string;
      relatedToType?: string;
      relatedToId?: string;
    }>,
  ): Promise<Array<{ toNumber: string; success: boolean; messageId?: string; error?: string }>> {
    const results: Array<{ toNumber: string; success: boolean; messageId?: string; error?: string }> = [];

    for (const msg of messages) {
      try {
        const smsConfig = await getServiceConfig('sms');
        const sms = await this.send({
          toNumber: msg.toNumber,
          body: msg.body,
          fromNumber: smsConfig.from_number || undefined,
          relatedToType: isSmsRelatedEntity(msg.relatedToType) ? msg.relatedToType : undefined,
          relatedToId: msg.relatedToId,
        });
        results.push({ toNumber: msg.toNumber, success: sms.status === 'sent', messageId: sms.id });
      } catch (e) {
        results.push({
          toNumber: msg.toNumber,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return results;
  },
};
