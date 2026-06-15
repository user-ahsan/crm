import { getSharedClient } from '@/lib/supabase/client';
import type { Lead, LeadFormData, LeadFilters } from '@/types/lead.types';
import type { DbLead, DbLeadScore, LeadInsert } from '@/types/supabase.types';
import type { LeadScore } from '@/types/lead-scoring.types';
import { findDuplicates } from '@/lib/utils';
import type { DuplicateGroup } from '@/lib/utils';
import { formatSupabaseError } from './supabase.service';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';

function mapScoreRow(row: DbLeadScore): LeadScore {
  return {
    id: row.id,
    leadId: row.lead_id,
    score: row.score,
    factors: row.factors,
    updatedAt: row.updated_at,
  };
}

function mapRowToLead(row: DbLead): Lead {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    companyName: row.company_name ?? undefined,
    industry: row.industry ?? undefined,
    country: row.country ?? undefined,
    source: row.source as Lead['source'],
    status: row.status as Lead['status'],
    priority: row.priority as Lead['priority'],
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
      if (error) throw new Error(error.message);
      return data?.map(mapRowToLead) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
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
        throw new Error(error.message);
      }
      return data ? mapRowToLead(data) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
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
      if (error) throw new Error(error.message);
      return data?.map(mapRowToLead) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async create(data: LeadFormData): Promise<Lead> {
    try {
      const supabase = await getSharedClient();
      if (data.assignedTo) {
        const { data: user } = await supabase.from('profiles').select('id').eq('id', data.assignedTo).maybeSingle();
        if (!user) throw new Error(`Lead assignedTo user ${data.assignedTo} not found`);
      }
      if (data.companyName) {
        const { data: existing } = await supabase.from('companies').select('id').eq('name', data.companyName).maybeSingle();
        if (!existing) {
          const { data: newCompany } = await supabase.from('companies').insert({ name: data.companyName }).select().single();
          if (!newCompany) throw new Error(`Failed to auto-create company "${data.companyName}"`);
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
      if (error) throw new Error(error.message);
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
      throw new Error(formatSupabaseError(e));
    }
  },

  async update(id: string, data: Partial<LeadFormData>): Promise<Lead | undefined> {
    try {
      const supabase = await getSharedClient();
      if (data.assignedTo) {
        const { data: user } = await supabase.from('profiles').select('id').eq('id', data.assignedTo).maybeSingle();
        if (!user) throw new Error(`Lead assignedTo user ${data.assignedTo} not found`);
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
        throw new Error(error.message);
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
      throw new Error(formatSupabaseError(e));
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      await supabase.from('tasks').delete().eq('related_to_id', id);
      await supabase.from('meetings').delete().eq('related_to_id', id);
      await supabase.from('activities').delete().eq('entity_id', id);
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw new Error(error.message);
      activityService.log('lead', id, 'deleted', `Lead deleted`);
      triggerWebhook('lead.deleted', { id });
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
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
      throw new Error(formatSupabaseError(e));
    }
  },

  async mergeLeads(survivorId: string, mergeIds: string[]): Promise<Lead> {
    try {
      const supabase = await getSharedClient();

      await supabase.from('tasks').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'lead');
      await supabase.from('meetings').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'lead');
      await supabase.from('activities').update({ entity_id: survivorId }).in('entity_id', mergeIds);
      await supabase.from('taggings').update({ taggable_id: survivorId }).in('taggable_id', mergeIds).eq('taggable_type', 'lead');

      for (const id of mergeIds) {
        await this.delete(id);
      }

      const survivor = await this.getById(survivorId);
      if (!survivor) throw new Error('Survivor lead not found after merge');
      activityService.log('lead', survivorId, 'updated', `Lead merged: merged ${mergeIds.length} duplicates`);
      return survivor;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async calculateScore(leadId: string): Promise<{ score: number; factors: Record<string, number> }> {
    const lead = await this.getById(leadId);
    if (!lead) throw new Error('Lead not found');
    const factors: Record<string, number> = {};
    let total = 0;
    if (lead.email) { factors.email_present = 20; total += 20; }
    if (lead.phone) { factors.phone_present = 15; total += 15; }
    if (lead.companyName) { factors.company_present = 10; total += 10; }
    if (lead.source === 'referral' || lead.source === 'website') { factors.source_quality = 15; total += 15; }
    const tagBonus = (lead.tags?.length ?? 0) * 5;
    if (tagBonus > 0) { factors.tags_count = tagBonus; total += tagBonus; }
    if (lead.status === 'lost') { factors.lost_penalty = -10; total -= 10; }
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
      if (error) throw new Error(error.message);
      return data ? mapScoreRow(data) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
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
      if (error) throw new Error(error.message);
      return mapScoreRow(data);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async batchUpdateScores(): Promise<{ updated: number; failed: number }> {
    try {
      const supabase = await getSharedClient();
      const { data: leads } = await supabase.from('leads').select('id');
      if (!leads) return { updated: 0, failed: 0 };
      let updated = 0;
      const failedIds: string[] = [];
      for (const lead of leads) {
        try {
          await this.updateScore(lead.id);
          updated++;
        } catch {
          failedIds.push(lead.id);
        }
      }
      if (failedIds.length > 0) {
        console.warn(`batchUpdateScores: ${failedIds.length} lead(s) failed (IDs: ${failedIds.join(', ')})`);
      }
      return { updated, failed: failedIds.length };
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getPipelineStats(): Promise<Record<Lead['status'], { count: number; value: number }>> {
    try {
      const allLeads = await this.getAll();
      const stats: Record<string, { count: number; value: number }> = {
        new: { count: 0, value: 0 },
        contacted: { count: 0, value: 0 },
        qualified: { count: 0, value: 0 },
        proposal: { count: 0, value: 0 },
        won: { count: 0, value: 0 },
        lost: { count: 0, value: 0 },
      };
      for (const lead of allLeads) {
        if (stats[lead.status]) {
          stats[lead.status].count++;
          stats[lead.status].value += lead.estimatedValue;
        }
      }
      return stats;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
