import { createClient } from '@/lib/supabase/client';
import type { Lead, LeadFormData, LeadFilters } from '@/types/lead.types';
import type { DbLead } from '@/types/supabase.types';
import { formatSupabaseError, addLocalActivity } from './supabase.service';

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

function mapLeadToDb(lead: Partial<LeadFormData>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
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
  async getAll(): Promise<Lead[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbLead[] | null)?.map(mapRowToLead) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to fetch leads');
    }
  },

  async getById(id: string): Promise<Lead | undefined> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapRowToLead(data as DbLead) : undefined;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch lead ${id}`);
    }
  },

  async getFiltered(filters: LeadFilters): Promise<Lead[]> {
    try {
      const supabase = await createClient();
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
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as DbLead[] | null)?.map(mapRowToLead) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to filter leads');
    }
  },

  async create(data: LeadFormData): Promise<Lead> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();
      const dbRow = {
        ...mapLeadToDb(data),
        created_at: now,
        updated_at: now,
      };
      const { data: inserted, error } = await supabase
        .from('leads')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const lead = mapRowToLead(inserted as DbLead);
      addLocalActivity('lead', lead.id, 'created', `Lead created: ${lead.fullName}${lead.companyName ? ` from ${lead.companyName}` : ''}`, {
        source: lead.source,
        value: lead.estimatedValue,
      });
      return lead;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to create lead');
    }
  },

  async update(id: string, data: Partial<LeadFormData>): Promise<Lead | undefined> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();
      const dbData = { ...mapLeadToDb(data), updated_at: now };
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
      const lead = mapRowToLead(updated as DbLead);
      if (data.status) {
        addLocalActivity('lead', id, 'status_changed', `Status changed to ${data.status}`, {
          to: data.status,
        });
      }
      addLocalActivity('lead', id, 'updated', `Lead updated: ${lead.fullName}`);
      return lead;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to update lead ${id}`);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw new Error(error.message);
      addLocalActivity('lead', id, 'deleted', `Lead deleted`);
      return true;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to delete lead ${id}`);
    }
  },

  async updateStatus(id: string, status: Lead['status']): Promise<Lead | undefined> {
    return this.update(id, { status });
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
      throw new Error(e instanceof Error ? e.message : 'Failed to get pipeline stats');
    }
  },
};
