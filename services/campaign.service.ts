import { getSharedClient } from '@/lib/supabase/client';
import type { EmailSequence, CampaignEmail, EmailSequenceFormData, CampaignEmailFormData, CampaignStatus } from '@/types/campaign.types';
import type { DbEmailSequence, DbCampaignEmail, EmailSequenceInsert, EmailSequenceUpdate, CampaignEmailInsert } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

function mapSequenceRow(row: DbEmailSequence): EmailSequence {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as CampaignStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEmailRow(row: DbCampaignEmail): CampaignEmail {
  return {
    id: row.id,
    sequenceId: row.sequence_id,
    subject: row.subject,
    body: row.body,
    delayDays: row.delay_days,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export const campaignService = {
  async getSequences(): Promise<EmailSequence[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('email_sequences')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data?.map(mapSequenceRow) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getSequence(id: string): Promise<EmailSequence | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('email_sequences')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapSequenceRow(data) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async createSequence(data: EmailSequenceFormData): Promise<EmailSequence> {
    try {
      const supabase = await getSharedClient();
      const { data: session } = await supabase.auth.getSession();
      const dbRow: Partial<EmailSequenceInsert> = {
        name: data.name,
        description: data.description ?? '',
        status: data.status ?? 'draft',
        created_by: session?.session?.user?.id ?? 'unknown',
      };

      const { data: inserted, error } = await supabase
        .from('email_sequences')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapSequenceRow(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async updateSequence(id: string, data: Partial<EmailSequenceFormData>): Promise<EmailSequence | undefined> {
    try {
      const supabase = await getSharedClient();
      const dbData: Partial<EmailSequenceUpdate> = {};
      if (data.name !== undefined) dbData.name = data.name;
      if (data.description !== undefined) dbData.description = data.description;
      if (data.status !== undefined) dbData.status = data.status;

      const { data: updated, error } = await supabase
        .from('email_sequences')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return updated ? mapSequenceRow(updated) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async deleteSequence(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.from('email_sequences').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async updateSequenceStatus(id: string, status: CampaignStatus): Promise<EmailSequence | undefined> {
    return this.updateSequence(id, { status });
  },

  async getCampaignEmails(sequenceId: string): Promise<CampaignEmail[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('campaign_emails')
        .select('*')
        .eq('sequence_id', sequenceId)
        .order('sort_order', { ascending: true });
      if (error) throw new Error(error.message);
      return data?.map(mapEmailRow) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async addCampaignEmail(data: CampaignEmailFormData): Promise<CampaignEmail> {
    try {
      const supabase = await getSharedClient();
      const dbRow: Partial<CampaignEmailInsert> = {
        sequence_id: data.sequenceId,
        subject: data.subject,
        body: data.body ?? '',
        delay_days: data.delayDays ?? 0,
        sort_order: data.sortOrder ?? 0,
      };
      const { data: inserted, error } = await supabase
        .from('campaign_emails')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapEmailRow(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async updateCampaignEmail(id: string, data: Partial<CampaignEmailFormData>): Promise<CampaignEmail | undefined> {
    try {
      const supabase = await getSharedClient();
      const dbData: Partial<CampaignEmailInsert> = {};
      if (data.subject !== undefined) dbData.subject = data.subject;
      if (data.body !== undefined) dbData.body = data.body;
      if (data.delayDays !== undefined) dbData.delay_days = data.delayDays;
      if (data.sortOrder !== undefined) dbData.sort_order = data.sortOrder;

      const { data: updated, error } = await supabase
        .from('campaign_emails')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return updated ? mapEmailRow(updated) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async deleteCampaignEmail(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.from('campaign_emails').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
