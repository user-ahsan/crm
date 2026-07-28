import { getSharedClient } from '@/lib/supabase/client';
import { isTwilioConfigured } from '@/lib/twilio-config';
import type { SmsLog, SmsFormData, SmsRelatedEntity } from '@/types/sms.types';
import type { DbSmsLog } from '@/types/supabase.types';
import { toServiceError } from './supabase.service';
import { activityService } from './activity.service';

function mapRowToSms(row: DbSmsLog): SmsLog {
  return {
    id: row.id,
    toNumber: row.to_number,
    fromNumber: row.from_number,
    body: row.body,
    direction: row.direction as SmsLog['direction'],
    status: row.status as SmsLog['status'],
    providerMessageId: row.provider_message_id ?? undefined,
    errorMessage: row.error_message ?? undefined,
    relatedToType: row.related_to_type as SmsLog['relatedToType'],
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
    const fromNumber = data.fromNumber || process.env.TWILIO_FROM_NUMBER || '+15551234567';
    try {
      const supabase = await getSharedClient();
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData?.user?.id ?? 'system';

      // Guard: if Twilio is not configured, save as 'queued' so the UI shows a clear signal
      const twilioAvailable = isTwilioConfigured();
      const status = twilioAvailable ? 'sent' as const : 'queued' as const;
      const errorMessage = twilioAvailable ? null : 'SMS provider not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to send SMS.';

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
      // The providerMessageId from Twilio is updated back via the API route.
      return { ...sms, errorMessage: errorMessage ?? undefined };
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
        const sms = await this.send({
          toNumber: msg.toNumber,
          body: msg.body,
          fromNumber: process.env.TWILIO_FROM_NUMBER,
          relatedToType: msg.relatedToType as SmsRelatedEntity,
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
