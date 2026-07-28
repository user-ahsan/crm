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

// Inline type for Supabase aggregate query results in getPipelineStats
type PipelineStatsRow = { status: string; count: number; value: number | null };

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
  if (lead.assignedTo !== undefined) db.assigned_to = lead.assignedTo || null;
  if (lead.estimatedValue !== undefined) db.estimated_value = lead.estimatedValue;
  if (lead.tags !== undefined) db.tags = lead.tags;
  if (lead.notes !== undefined) db.notes = lead.notes || null;
  return db;
}

export const leadService = {
  async getAll(page = 1, pageSize = 50): Promise<Lead[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
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
    try {
      const supabase = await getSharedClient();
      if (data.assignedTo) {
        const { data: user, error: userErr } = await supabase.from('profiles').select('id').eq('id', data.assignedTo).maybeSingle();
        if (userErr) throw toServiceError(userErr);
        if (!user) throw new ServiceError(`Lead assignedTo user ${data.assignedTo} not found`, 'USER_NOT_FOUND');
      }
      if (data.companyName) {
        const { data: existing, error: existingErr } = await supabase.from('companies').select('id').eq('name', data.companyName).maybeSingle();
        if (existingErr) throw toServiceError(existingErr);
        if (!existing) {
          const { data: newCompany, error: newCompanyErr } = await supabase.from('companies').insert({ name: data.companyName }).select().single();
          if (newCompanyErr) throw toServiceError(newCompanyErr);
          if (!newCompany) throw new ServiceError(`Failed to auto-create company "${data.companyName}"`, 'COMPANY_CREATE_FAILED');
          // Set the company_id on the lead row
          const leadWithCompany = { ...mapLeadToDb(data) };
          const fullRow = { ...leadWithCompany, company_id: newCompany.id };
          const { data: inserted, error: insertErr } = await supabase
            .from('leads')
            .insert(fullRow)
            .select()
            .single();
          if (insertErr) throw toServiceError(insertErr);
          const lead = mapRowToLead(inserted);
          activityService.log('lead', lead.id, 'created', `Lead created: ${lead.fullName}${lead.companyName ? ` from ${lead.companyName}` : ''}`, {
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
          return lead;
        }
      }
      const dbRow = {
        ...mapLeadToDb(data),
      };
      const { data: inserted, error } = await supabase
        .from('leads')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw toServiceError(error);
      const lead = mapRowToLead(inserted);
      activityService.log('lead', lead.id, 'created', `Lead created: ${lead.fullName}${lead.companyName ? ` from ${lead.companyName}` : ''}`, {
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
      return lead;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async update(id: string, data: Partial<LeadFormData>): Promise<Lead | undefined> {
    try {
      const supabase = await getSharedClient();
      if (data.assignedTo) {
        const { data: user, error: userErr } = await supabase.from('profiles').select('id').eq('id', data.assignedTo).maybeSingle();
        if (userErr) throw toServiceError(userErr);
        if (!user) throw new ServiceError(`Lead assignedTo user ${data.assignedTo} not found`, 'USER_NOT_FOUND');
      }
      const dbData = { ...mapLeadToDb(data) };
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
      if (data.status) {
        activityService.log('lead', id, 'status_changed', `Status changed to ${data.status}`, {
          to: data.status,
        });
      }
      activityService.log('lead', id, 'updated', `Lead updated: ${lead.fullName}`);
      triggerWebhook('lead.updated', { id, ...data });
      return lead;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const ops = [
        supabase.from('tasks').delete().eq('related_to_id', id),
        supabase.from('meetings').delete().eq('related_to_id', id),
        supabase.from('activities').delete().eq('entity_id', id),
      ];
      const results = await Promise.all(ops);
      for (const r of results) if (r.error) console.error(`Cascade delete error: ${r.error.message}`);
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw toServiceError(error);
      activityService.log('lead', id, 'deleted', `Lead deleted`);
      triggerWebhook('lead.deleted', { id });
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
   * @see contactService.findDuplicates — same pattern with different weights
   */
  async findDuplicates(): Promise<DuplicateGroup<Lead>[]> {
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
        25,
      );
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async mergeLeads(survivorId: string, mergeIds: string[]): Promise<Lead> {
    try {
      const supabase = await getSharedClient();

      const { error: tasksErr } = await supabase.from('tasks').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'lead');
      if (tasksErr) console.error(`Merge tasks update error: ${tasksErr.message}`);

      const { error: meetingsErr } = await supabase.from('meetings').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'lead');
      if (meetingsErr) console.error(`Merge meetings update error: ${meetingsErr.message}`);

      const { error: activitiesErr } = await supabase.from('activities').update({ entity_id: survivorId }).in('entity_id', mergeIds);
      if (activitiesErr) console.error(`Merge activities update error: ${activitiesErr.message}`);

      const { error: taggingsErr } = await supabase.from('taggings').update({ taggable_id: survivorId }).in('taggable_id', mergeIds).eq('taggable_type', 'lead');
      if (taggingsErr) console.error(`Merge taggings update error: ${taggingsErr.message}`);

      for (const id of mergeIds) {
        await this.delete(id);
      }

      const survivor = await this.getById(survivorId);
      if (!survivor) throw new ServiceError('Survivor lead not found after merge', 'MERGE_FAILED');
      activityService.log('lead', survivorId, 'updated', `Lead merged: merged ${mergeIds.length} duplicates`);
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

  async batchUpdateScores(): Promise<{ updated: number; failed: number }> {
    try {
      const supabase = await getSharedClient();
      const { data: leads, error: leadsErr } = await supabase.from('leads').select('id');
      if (leadsErr) throw toServiceError(leadsErr);
      if (!leads || leads.length === 0) return { updated: 0, failed: 0 };

      const scoresMap = new Map<string, { score: number; factors: Record<string, number> }>();

      for (const lead of leads as { id: string }[]) {
        try {
          const score = await this.calculateScore(lead.id);
          scoresMap.set(lead.id, score);
        } catch (err) {
          console.error(`[LeadService] calculateScore failed for lead ${lead.id}:`, err);
        }
      }

      const scoreEntries = Array.from(scoresMap.entries());
      let updated = 0;
      const failedIds: string[] = [];

      for (const [leadId, { score, factors }] of scoreEntries) {
        try {
          const { error: upsertErr } = await supabase
            .from('lead_scores')
            .upsert({ lead_id: leadId, score, factors }, { onConflict: 'lead_id' });
          if (upsertErr) throw upsertErr;
          updated++;
        } catch (err) {
          console.error(`[LeadService] upsert score failed for lead ${leadId}:`, err);
          failedIds.push(leadId);
        }
      }

      if (failedIds.length > 0) {
        console.warn(`batchUpdateScores: ${failedIds.length} lead(s) failed (IDs: ${failedIds.join(', ')})`);
      }
      return { updated, failed: failedIds.length };
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getPipelineStats(): Promise<Record<Lead['status'], { count: number; value: number }>> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('leads')
        .select('status, count:count(*), value:sum(estimated_value)')
        .is('deleted_at', null)
        .neq('status', 'lost');

      if (error) throw toServiceError(error);

      const defaults: Record<string, { count: number; value: number }> = {
        new: { count: 0, value: 0 },
        contacted: { count: 0, value: 0 },
        qualified: { count: 0, value: 0 },
        proposal: { count: 0, value: 0 },
        won: { count: 0, value: 0 },
        lost: { count: 0, value: 0 },
      };

      for (const row of (data as unknown as PipelineStatsRow[]) ?? []) {
        const status = asEnum(row.status, LEAD_STATUSES);
        if (defaults[status]) {
          defaults[status] = { count: row.count, value: row.value ?? 0 };
        }
      }

      return defaults as Record<Lead['status'], { count: number; value: number }>;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
