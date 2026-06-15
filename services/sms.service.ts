import { getSharedClient } from '@/lib/supabase/client';
import type { SmsLog, SmsFormData } from '@/types/sms.types';
import type { DbSmsLog, SmsLogInsert } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';
import { activityService } from './activity.service';

function mapRowToSms(row: DbSmsLog): SmsLog {
  return {
    id: row.id,
    toNumber: row.to_number,
    fromNumber: row.from_number,
    body: row.body,
    direction: row.direction as SmsLog['direction'],
    status: row.status as SmsLog['status'],
    relatedToType: row.related_to_type as SmsLog['relatedToType'],
    relatedToId: row.related_to_id ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
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
      if (error) throw new Error(error.message);
      return data?.map(mapRowToSms) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async send(data: SmsFormData): Promise<SmsLog> {
    try {
      const supabase = await getSharedClient();
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData?.user?.id ?? 'system';
      const dbRow = {
        to_number: data.toNumber,
        from_number: data.fromNumber ?? '+15551234567',
        body: data.body,
        direction: 'outbound',
        status: 'sent',
        related_to_type: data.relatedToType ?? null,
        related_to_id: data.relatedToId ?? null,
        created_by: createdBy,
      };
      const { data: inserted, error } = await supabase
        .from('sms_logs')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const sms = mapRowToSms(inserted);
      if (data.relatedToType && data.relatedToId) {
        activityService.log(
          data.relatedToType,
          data.relatedToId,
          'communication_logged',
          `SMS sent to ${data.toNumber}: ${data.body.slice(0, 60)}`,
          { direction: 'outbound', to: data.toNumber },
        );
      }
      return sms;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
