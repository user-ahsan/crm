import { getSharedClient } from '@/lib/supabase/client';
import type { Lead, LeadFormData, LeadFilters } from '@/types/lead.types';
import type { DbLead, DbLeadScore, LeadInsert } from '@/types/supabase.types';
import type { LeadScore } from '@/types/lead-scoring.types';
import { findDuplicates } from '@/lib/utils';
import type { DuplicateGroup } from '@/lib/utils';
import { asEnum, ServiceError, toServiceError } from './supabase.service';
import { LEAD_SCORE_EMAIL_PRESENT, LEAD_SCORE_PHONE_PRESENT, LEAD_SCORE_COMPANY_PRESENT, LEAD_SCORE_SOURCE_QUALITY, LEAD_SCORE_TAG_BONUS, LEAD_SCORE_LOST_PENALTY } from '@/lib/constants';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';
import { automationService } from './automation.service';

/** Sentinel value used by assignee dropdowns to mean "no assignee" (PATTERN-users §4). */
const UNASSIGNED = 'unassigned';

function mapScoreRow(row: DbLeadScore): LeadScore {
  return {
    id: row.id,
    leadId: row.lead_id,
    score: row.score,
    factors: row.factors,
    updatedAt: row.updated_at,
  };
}

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const;
const LEAD_SOURCES = ['manual', 'website', 'referral', 'ads', 'social'] as const;
const LEAD_PRIORITIES = ['low', 'medium', 'high'] as const;

function mapRowToLead(row: DbLead): Lead {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    companyName: row.company_name ?? undefined,
    industry: row.industry ?? undefined,
    country: row.country ?? undefined,
    source: asEnum(row.source, LEAD_SOURCES),
    status: asEnum(row.status, LEAD_STATUSES),
    priority: asEnum(row.priority, LEAD_PRIORITIES),
    assignedTo: row.assigned_to ?? undefined,
    estimatedValue: row.estimated_value,
    tags: row.tags ?? [],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLeadToDb(lead: Partial<LeadFormData>): Partial<LeadInsert> {
  const db: Partial<LeadInsert> = {};
  if (lead.fullName !== undefined) db.full_name = lead.fullName;
  if (lead.email !== undefined) db.email = lead.email || null;
  if (lead.phone !== undefined) db.phone = lead.phone || null;
  if (lead.companyName !== undefined) db.company_name = lead.companyName || null;
  if (lead.industry !== undefined) db.industry = lead.industry || null;
  if (lead.country !== undefined) db.country = lead.country || null;
  if (lead.source !== undefined) db.source = lead.source;
  if (lead.status !== undefined) db.status = lead.status;
  if (lead.priority !== undefined) db.priority = lead.priority;
  if (lead.assignedTo !== undefined) {
    // The 'unassigned' sentinel from assignee dropdowns means "no assignee".
    db.assigned_to = lead.assignedTo === UNASSIGNED ? null : (lead.assignedTo || null);
  }
  if (lead.estimatedValue !== undefined) db.estimated_value = lead.estimatedValue;
  if (lead.tags !== undefined) db.tags = lead.tags;
  if (lead.notes !== undefined) db.notes = lead.notes || null;
  return db;
}

/** Returns true when an assignee value should be validated against the profiles table. */
function needsAssigneeValidation(assignee: string | undefined): assignee is string {
  return !!assignee && assignee !== UNASSIGNED;
}

export const leadService = {
  /**
   * Fetches all leads ordered by creation date (descending).
   * Pagination is optional: unless the caller passes a pageSize, the full
   * dataset is returned (the UI has no pager; findDuplicates must scan all).
   */
  async getAll(page = 1, pageSize?: number): Promise<Lead[]> {
    try {
      const supabase = await getSharedClient();
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (pageSize !== undefined && pageSize > 0) {
        query = query.range((page - 1) * pageSize, page * pageSize - 1);
      }
      const { data, error } = await query;
      if (error) throw toServiceError(error);
      return data?.map(mapRowToLead) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getById(id: string): Promise<Lead | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data ? mapRowToLead(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getFiltered(filters: LeadFilters, page = 1, pageSize = 50): Promise<Lead[]> {
    try {
      const supabase = await getSharedClient();
      let query = supabase.from('leads').select('*');
      if (filters.search) {
        const s = filters.search.toLowerCase();
        query = query.or(
          `full_name.ilike.%${s}%,email.ilike.%${s}%,company_name.ilike.%${s}%`,
        );
      }
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.source) query = query.eq('source', filters.source);
      if (filters.priority) query = query.eq('priority', filters.priority);
      if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
      query = query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error } = await query;
      if (error) throw toServiceError(error);
      return data?.map(mapRowToLead) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async create(data: LeadFormData): Promise<Lead> {
    // Tracks a company auto-created by this call so it can be removed if the
    // lead insert fails (best-effort cleanup — the create is transactional-ish).
    let createdCompanyId: string | undefined;
    try {
      const supabase = await getSharedClient();
      if (needsAssigneeValidation(data.assignedTo)) {
        const { data: user, error: userErr } = await supabase.from('profiles').select('id').eq('id', data.assignedTo).maybeSingle();
        if (userErr) throw toServiceError(userErr);
        if (!user) throw new ServiceError(`Lead assignedTo user ${data.assignedTo} not found`, 'USER_NOT_FOUND');
      }

      // Auto-create a company row when a new company name is provided. This
      // is best-effort: the lead always stores its company_name, and an RLS
      // denial (agents cannot create companies — PATTERN-rls) or transient
      // failure must not block lead creation. The company is only linked by
      // name (leads has no company_id column).
      if (data.companyName && data.companyName.trim()) {
        const { data: existing, error: existingErr } = await supabase.from('companies').select('id').eq('name', data.companyName).maybeSingle();
        if (existingErr) throw toServiceError(existingErr);
        if (!existing) {
          const { data: newCompany, error: newCompanyErr } = await supabase.from('companies').insert({ name: data.companyName }).select().single();
          if (!newCompanyErr && newCompany) {
            createdCompanyId = newCompany.id;
          }
        }
      }

      const { data: inserted, error } = await supabase
        .from('leads')
        .insert(mapLeadToDb(data))
        .select()
        .single();
      if (error) throw toServiceError(error);
      const lead = mapRowToLead(inserted);
      await activityService.log('lead', lead.id, 'created', `Lead created: ${lead.fullName}${lead.companyName ? ` from ${lead.companyName}` : ''}`, {
        source: lead.source,
        value: lead.estimatedValue,
      });
      triggerWebhook('lead.created', {
        id: lead.id,
        fullName: lead.fullName,
        email: lead.email,
        source: lead.source,
        status: lead.status,
        estimatedValue: lead.estimatedValue,
      });
      await automationService.evaluate('lead.created', {
        entityType: 'lead',
        entityId: lead.id,
        fullName: lead.fullName,
        email: lead.email,
        source: lead.source,
        status: lead.status,
        estimatedValue: lead.estimatedValue,
      });
      return lead;
    } catch (e) {
      // Best-effort rollback of the auto-created company when the lead insert
      // failed, so no orphan company row is left behind.
      if (createdCompanyId) {
        try {
          const supabase = await getSharedClient();
          await supabase.from('companies').delete().eq('id', createdCompanyId);
        } catch {
          // Cleanup is best-effort; the original error below is what surfaces.
        }
      }
      throw toServiceError(e);
    }
  },

  async update(id: string, data: Partial<LeadFormData>): Promise<Lead | undefined> {
    try {
      const supabase = await getSharedClient();

      // Detect the status transition BEFORE the write (PATTERN-webhooks §3a).
      const { data: existingRow } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      const previousStatus = existingRow ? mapRowToLead(existingRow).status : undefined;
      const statusChanged = !!existingRow
        && data.status !== undefined
        && data.status !== previousStatus;

      if (needsAssigneeValidation(data.assignedTo)) {
        const { data: user, error: userErr } = await supabase.from('profiles').select('id').eq('id', data.assignedTo).maybeSingle();
        if (userErr) throw toServiceError(userErr);
        if (!user) throw new ServiceError(`Lead assignedTo user ${data.assignedTo} not found`, 'USER_NOT_FOUND');
      }

      const dbData = mapLeadToDb(data);
      const { data: updated, error } = await supabase
        .from('leads')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      const lead = mapRowToLead(updated);

      if (statusChanged) {
        // Log ONLY the status activity when the status transitioned — no
        // double-logging of 'updated' (PATTERN-webhooks §3a).
        await activityService.log('lead', id, 'status_changed', `Status changed to ${lead.status}`, {
          from: previousStatus,
          to: lead.status,
        });
        triggerWebhook('lead.status_changed', {
          id: lead.id,
          fullName: lead.fullName,
          previousStatus,
          status: lead.status,
        });
        await automationService.evaluate('lead.status_changed', {
          entityType: 'lead',
          entityId: lead.id,
          fullName: lead.fullName,
          status: lead.status,
          previousStatus,
        });
      } else {
        await activityService.log('lead', id, 'updated', `Lead updated: ${lead.fullName}`);
        triggerWebhook('lead.updated', { id, ...data });
        await automationService.evaluate('lead.updated', { entityType: 'lead', entityId: id, ...data });
      }
      return lead;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      // Cascade deletes are scoped by related-entity type (C16): an id shared
      // across entity types must never delete another entity's records.
      const ops = [
        supabase.from('tasks').delete().eq('related_to_id', id).eq('related_to_type', 'lead'),
        supabase.from('meetings').delete().eq('related_to_id', id).eq('related_to_type', 'lead'),
        supabase.from('activities').delete().eq('entity_id', id).eq('entity_type', 'lead'),
        supabase.from('notes').delete().eq('related_to_id', id).eq('related_to_type', 'lead'),
        supabase.from('email_history').delete().eq('related_to_id', id).eq('related_to_type', 'lead'),
        supabase.from('call_logs').delete().eq('related_to_id', id).eq('related_to_type', 'lead'),
        supabase.from('sms_logs').delete().eq('related_to_id', id).eq('related_to_type', 'lead'),
        supabase.from('file_attachments').delete().eq('related_to_id', id).eq('related_to_type', 'lead'),
        supabase.from('taggings').delete().eq('taggable_id', id).eq('taggable_type', 'lead'),
        supabase.from('lead_scores').delete().eq('lead_id', id),
      ];
      const results = await Promise.all(ops);
      const failed = results.find((r) => r.error);
      // Cascade failures must throw so hooks roll back / surface the error —
      // never console-only, never delete the lead while its relations leak.
      if (failed?.error) throw toServiceError(failed.error);

      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw toServiceError(error);
      await activityService.log('lead', id, 'deleted', `Lead deleted`);
      triggerWebhook('lead.deleted', { id });
      await automationService.evaluate('lead.deleted', { entityType: 'lead', entityId: id });
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async updateStatus(id: string, status: Lead['status']): Promise<Lead | undefined> {
    return this.update(id, { status });
  },

  /**
   * Find duplicate leads using email, phone, name, and company matching.
   * Uses shared utilities from @/lib/utils (normalizePhone, fuzzyNameMatch).
   * Scans ALL leads (getAll returns the full dataset by default).
   * @see contactService.findDuplicates — same pattern with different weights
   */
  async findDuplicates(threshold?: number): Promise<DuplicateGroup<Lead>[]> {
    try {
      const all = await this.getAll();
      return findDuplicates(
        all,
        [
          { key: (l: Lead) => l.email ?? '', weight: 40, type: 'exact' as const },
          { key: (l: Lead) => l.phone ?? '', weight: 35, type: 'normalized' as const },
          { key: (l: Lead) => l.fullName ?? '', weight: 15, type: 'fuzzy' as const },
          { key: (l: Lead) => l.companyName ?? '', weight: 10, type: 'exact' as const },
        ],
        threshold ?? 25,
      );
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async mergeLeads(survivorId: string, mergeIds: string[]): Promise<Lead> {
    try {
      const supabase = await getSharedClient();
      const victims = mergeIds.filter((mergeId) => mergeId !== survivorId);

      // Re-point every related record to the survivor, scoped by entity type
      // so an id collision with another entity's records can never steal them.
      const repointOps = [
        supabase.from('tasks').update({ related_to_id: survivorId }).in('related_to_id', victims).eq('related_to_type', 'lead'),
        supabase.from('meetings').update({ related_to_id: survivorId }).in('related_to_id', victims).eq('related_to_type', 'lead'),
        supabase.from('notes').update({ related_to_id: survivorId }).in('related_to_id', victims).eq('related_to_type', 'lead'),
        supabase.from('email_history').update({ related_to_id: survivorId }).in('related_to_id', victims).eq('related_to_type', 'lead'),
        supabase.from('call_logs').update({ related_to_id: survivorId }).in('related_to_id', victims).eq('related_to_type', 'lead'),
        supabase.from('sms_logs').update({ related_to_id: survivorId }).in('related_to_id', victims).eq('related_to_type', 'lead'),
        supabase.from('file_attachments').update({ related_to_id: survivorId }).in('related_to_id', victims).eq('related_to_type', 'lead'),
        supabase.from('activities').update({ entity_id: survivorId }).in('entity_id', victims).eq('entity_type', 'lead'),
        supabase.from('taggings').update({ taggable_id: survivorId }).in('taggable_id', victims).eq('taggable_type', 'lead'),
      ];
      const results = await Promise.all(repointOps);
      const failed = results.find((r) => r.error);
      // Failures surface via the error path (hooks roll back / show a toast).
      if (failed?.error) throw toServiceError(failed.error);

      for (const id of victims) {
        await this.delete(id);
      }

      const survivor = await this.getById(survivorId);
      if (!survivor) throw new ServiceError('Survivor lead not found after merge', 'MERGE_FAILED');
      await activityService.log('lead', survivorId, 'updated', `Lead merged: merged ${victims.length} duplicates`);
      return survivor;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async calculateScore(leadId: string): Promise<{ score: number; factors: Record<string, number> }> {
    const lead = await this.getById(leadId);
    if (!lead) throw new ServiceError('Lead not found', 'LEAD_NOT_FOUND');
    const factors: Record<string, number> = {};
    let total = 0;
    if (lead.email) { factors.email_present = LEAD_SCORE_EMAIL_PRESENT; total += LEAD_SCORE_EMAIL_PRESENT; }
    if (lead.phone) { factors.phone_present = LEAD_SCORE_PHONE_PRESENT; total += LEAD_SCORE_PHONE_PRESENT; }
    if (lead.companyName) { factors.company_present = LEAD_SCORE_COMPANY_PRESENT; total += LEAD_SCORE_COMPANY_PRESENT; }
    if (lead.source === 'referral' || lead.source === 'website') { factors.source_quality = LEAD_SCORE_SOURCE_QUALITY; total += LEAD_SCORE_SOURCE_QUALITY; }
    const tagBonus = (lead.tags?.length ?? 0) * LEAD_SCORE_TAG_BONUS;
    if (tagBonus > 0) { factors.tags_count = tagBonus; total += tagBonus; }
    if (lead.status === 'lost') { factors.lost_penalty = LEAD_SCORE_LOST_PENALTY; total += LEAD_SCORE_LOST_PENALTY; }
    return { score: Math.max(0, Math.min(100, total)), factors };
  },

  async getScore(leadId: string): Promise<LeadScore | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('lead_scores')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();
      if (error) throw toServiceError(error);
      return data ? mapScoreRow(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async updateScore(leadId: string): Promise<LeadScore> {
    const { score, factors } = await this.calculateScore(leadId);
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('lead_scores')
        .upsert({ lead_id: leadId, score, factors }, { onConflict: 'lead_id' })
        .select()
        .single();
      if (error) throw toServiceError(error);
      return mapScoreRow(data);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getAllScores(): Promise<LeadScore[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase.from('lead_scores').select('*');
      if (error) throw toServiceError(error);
      return (data ?? []).map(mapScoreRow);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async batchUpdateScores(): Promise<{ updated: number; failed: number; failedIds: string[] }> {
    try {
      const supabase = await getSharedClient();
      const { data: leads, error: leadsErr } = await supabase.from('leads').select('id');
      if (leadsErr) throw toServiceError(leadsErr);
      if (!leads || leads.length === 0) return { updated: 0, failed: 0, failedIds: [] };

      const scoresMap = new Map<string, { score: number; factors: Record<string, number> }>();
      const failedIds: string[] = [];

      for (const row of leads) {
        const leadId = typeof row?.id === 'string' ? row.id : '';
        if (!leadId) continue;
        try {
          const score = await this.calculateScore(leadId);
          scoresMap.set(leadId, score);
        } catch {
          failedIds.push(leadId);
        }
      }

      let updated = 0;
      for (const [leadId, { score, factors }] of scoresMap.entries()) {
        try {
          const { error: upsertErr } = await supabase
            .from('lead_scores')
            .upsert({ lead_id: leadId, score, factors }, { onConflict: 'lead_id' });
          if (upsertErr) throw upsertErr;
          updated++;
        } catch {
          failedIds.push(leadId);
        }
      }

      // Per-lead failures are returned in the typed result (never console-only)
      // so callers can surface which leads failed.
      return { updated, failed: failedIds.length, failedIds };
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getPipelineStats(): Promise<Record<Lead['status'], { count: number; value: number }>> {
    try {
      const supabase = await getSharedClient();
      // Fetch the minimal projection and aggregate in JS. This keeps soft-
      // deleted filtering (deleted_at) correct in BOTH modes: real rows carry
      // the column; mock rows lack it (undefined is treated as not deleted).
      // The lost stage is included — lost leads report their own real counts.
      const { data, error } = await supabase
        .from('leads')
        .select('status, estimated_value, deleted_at');
      if (error) throw toServiceError(error);

      const stats: Record<Lead['status'], { count: number; value: number }> = {
        new: { count: 0, value: 0 },
        contacted: { count: 0, value: 0 },
        qualified: { count: 0, value: 0 },
        proposal: { count: 0, value: 0 },
        won: { count: 0, value: 0 },
        lost: { count: 0, value: 0 },
      };

      for (const row of data ?? []) {
        if (row.deleted_at != null) continue;
        const status = LEAD_STATUSES.find((s) => s === row.status);
        if (!status) continue;
        stats[status].count += 1;
        stats[status].value += typeof row.estimated_value === 'number' ? row.estimated_value : 0;
      }

      return stats;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
