import { getSharedClient } from '@/lib/supabase/client';
import { automationService } from './automation.service';
import { triggerWebhook } from './webhook.service';
import { ServiceError, toServiceError } from './supabase.service';
import type {
  EmailSequence,
  CampaignEmail,
  EmailSequenceFormData,
  CampaignEmailFormData,
  CampaignStatus,
} from '@/types/campaign.types';
import type {
  DbEmailSequence,
  DbCampaignEmail,
  EmailSequenceInsert,
  EmailSequenceUpdate,
  CampaignEmailInsert,
  CampaignEmailUpdate,
} from '@/types/supabase.types';

function mapSequenceRow(row: DbEmailSequence): EmailSequence {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
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

/**
 * Allowed lifecycle transitions (FEATURES.md §17: draft → active →
 * paused → completed).
 *
 * 'active' is deliberately NOT reachable through this service:
 *   - draft → active  → campaignScheduler.activateSequence (queues recipients)
 *   - paused → active → campaignScheduler.resumeSequence (already queued)
 * Both live in the scheduler service, which is the only path that can set
 * a sequence active. 'completed' is terminal — no transitions out.
 */
const STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: [],
};

export const campaignService = {
  async getSequences(): Promise<EmailSequence[]> {
    try {
      const supabase = getSharedClient();
      const { data, error } = await supabase
        .from('email_sequences')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw toServiceError(error);
      return data?.map(mapSequenceRow) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getSequence(id: string): Promise<EmailSequence | undefined> {
    try {
      const supabase = getSharedClient();
      const { data, error } = await supabase
        .from('email_sequences')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data ? mapSequenceRow(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async createSequence(data: EmailSequenceFormData): Promise<EmailSequence> {
    try {
      // Sequences always start as drafts — an active/paused/completed value
      // on create would bypass recipient queueing entirely.
      if (data.status !== undefined && data.status !== 'draft') {
        throw new ServiceError(
          'Sequences can only be created in draft status. Use campaignScheduler.activateSequence to start a campaign (it queues recipients).',
          'INVALID_TRANSITION',
        );
      }
      const supabase = getSharedClient();
      const { data: session } = await supabase.auth.getSession();
      const dbRow: EmailSequenceInsert = {
        name: data.name,
        description: data.description ?? '',
        status: 'draft',
        created_by: session?.session?.user?.id ?? 'system',
      };

      const { data: inserted, error } = await supabase
        .from('email_sequences')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw toServiceError(error);
      return mapSequenceRow(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async updateSequence(id: string, data: Partial<EmailSequenceFormData>): Promise<EmailSequence | undefined> {
    try {
      if (data.status !== undefined) {
        throw new ServiceError(
          'Status changes must go through the campaign lifecycle: use campaignService.updateSequenceStatus for paused/completed, or campaignScheduler.activateSequence / campaignScheduler.resumeSequence to make a sequence active.',
          'INVALID_TRANSITION',
        );
      }
      const supabase = getSharedClient();
      const dbData: EmailSequenceUpdate = {};
      if (data.name !== undefined) dbData.name = data.name;
      if (data.description !== undefined) dbData.description = data.description;
      if (Object.keys(dbData).length === 0) return undefined;

      const { data: updated, error } = await supabase
        .from('email_sequences')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return updated ? mapSequenceRow(updated) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async deleteSequence(id: string): Promise<boolean> {
    try {
      const supabase = getSharedClient();
      // Cascade delete campaign_emails and campaign_recipients first; fail
      // loudly on any child failure so orphans never accumulate silently.
      const ops = [
        supabase.from('campaign_recipients').delete().eq('sequence_id', id),
        supabase.from('campaign_emails').delete().eq('sequence_id', id),
      ];
      const results = await Promise.all(ops);
      for (const r of results) if (r.error) throw toServiceError(r.error);
      const { error } = await supabase.from('email_sequences').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Applies a status transition with workflow enforcement.
   *
   * 'active' is rejected outright — activation only happens through
   * campaignScheduler.activateSequence (draft → active, queues recipients)
   * or campaignScheduler.resumeSequence (paused → active). Same-status
   * transitions are idempotent no-ops. 'completed' is terminal.
   */
  async updateSequenceStatus(id: string, status: CampaignStatus): Promise<EmailSequence | undefined> {
    try {
      if (status === 'active') {
        throw new ServiceError(
          'A sequence can only become active through activation, which queues recipients: campaignScheduler.activateSequence (draft) or campaignScheduler.resumeSequence (paused).',
          'INVALID_TRANSITION',
        );
      }
      const current = await this.getSequence(id);
      if (!current) return undefined;
      if (current.status === status) return current; // idempotent same-status no-op

      const allowed = STATUS_TRANSITIONS[current.status];
      if (!allowed.includes(status)) {
        throw new ServiceError(
          `Invalid status transition: ${current.status} → ${status}. Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none — completed is terminal'}`,
          'INVALID_TRANSITION',
        );
      }

      const supabase = getSharedClient();
      const dbData: EmailSequenceUpdate = { status };
      const { data: updated, error } = await supabase
        .from('email_sequences')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw toServiceError(error);
      const sequence = updated ? mapSequenceRow(updated) : current;

      // Lifecycle dispatch (fire-and-forget; evaluate never throws).
      if (status === 'paused') {
        triggerWebhook('campaign.paused', { id: sequence.id, name: sequence.name, status });
        await automationService.evaluate('campaign.paused', {
          entityType: 'campaign',
          entityId: sequence.id,
          name: sequence.name,
          status,
        });
      } else if (status === 'completed') {
        triggerWebhook('campaign.completed', { id: sequence.id, name: sequence.name, status });
        await automationService.evaluate('campaign.completed', {
          entityType: 'campaign',
          entityId: sequence.id,
          name: sequence.name,
          status,
        });
      }

      return sequence;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getCampaignEmails(sequenceId: string): Promise<CampaignEmail[]> {
    try {
      const supabase = getSharedClient();
      const { data, error } = await supabase
        .from('campaign_emails')
        .select('*')
        .eq('sequence_id', sequenceId)
        .order('sort_order', { ascending: true });
      if (error) throw toServiceError(error);
      return data?.map(mapEmailRow) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async addCampaignEmail(data: CampaignEmailFormData): Promise<CampaignEmail> {
    try {
      const supabase = getSharedClient();
      const dbRow: CampaignEmailInsert = {
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
      if (error) throw toServiceError(error);
      return mapEmailRow(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async updateCampaignEmail(id: string, data: Partial<CampaignEmailFormData>): Promise<CampaignEmail | undefined> {
    try {
      const supabase = getSharedClient();
      const dbData: CampaignEmailUpdate = {};
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
        throw toServiceError(error);
      }
      return updated ? mapEmailRow(updated) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async deleteCampaignEmail(id: string): Promise<boolean> {
    try {
      const supabase = getSharedClient();
      const { error } = await supabase.from('campaign_emails').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Reorders the sequence's campaign emails by rewriting sort_order to the
   * position of each id in `orderedEmailIds`. Requires the full ordered id
   * list (a permutation of the sequence's emails) so the result is always
   * a clean 0-based ordering — partial payloads are rejected rather than
   * leaving gaps. Per-id update loop is mock-compatible (the mock surface
   * has no batch update).
   */
  async reorderEmails(sequenceId: string, orderedEmailIds: string[]): Promise<CampaignEmail[]> {
    try {
      const existing = await this.getCampaignEmails(sequenceId);
      const existingIds = new Set(existing.map((email) => email.id));
      if (orderedEmailIds.length !== existingIds.size) {
        throw new ServiceError(
          'Reorder must include every email in the sequence exactly once',
          'VALIDATION_ERROR',
        );
      }
      const seen = new Set<string>();
      for (const emailId of orderedEmailIds) {
        if (!existingIds.has(emailId)) {
          throw new ServiceError(`Email ${emailId} does not belong to sequence ${sequenceId}`, 'VALIDATION_ERROR');
        }
        if (seen.has(emailId)) {
          throw new ServiceError(`Duplicate email id in reorder payload: ${emailId}`, 'VALIDATION_ERROR');
        }
        seen.add(emailId);
      }
      if (orderedEmailIds.length === 0) return [];

      const supabase = getSharedClient();
      for (let i = 0; i < orderedEmailIds.length; i++) {
        const { error } = await supabase
          .from('campaign_emails')
          .update({ sort_order: i })
          .eq('id', orderedEmailIds[i]);
        if (error) throw toServiceError(error);
      }
      return this.getCampaignEmails(sequenceId);
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
