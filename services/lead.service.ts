import { leads as mockLeads } from '@/data/leads';
import type { Lead, LeadFormData, LeadFilters } from '@/types/lead.types';
import type { DbLead } from '@/types/supabase.types';
import { generateId } from '@/lib/formatters';
import { isSupabaseConfigured, getSupabaseClient as getSupabaseClientAsync, formatSupabaseError, addLocalActivity } from './supabase.service';

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
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbLead[] | null)?.map(mapRowToLead) ?? [];
    }
    return [...mockLeads];
  },

  async getById(id: string): Promise<Lead | undefined> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined; // not found
        throw new Error(formatSupabaseError(error));
      }
      return data ? mapRowToLead(data as DbLead) : undefined;
    }
    return mockLeads.find((l) => l.id === id);
  },

  async getFiltered(filters: LeadFilters): Promise<Lead[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
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
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbLead[] | null)?.map(mapRowToLead) ?? [];
    }
    return mockLeads.filter((lead) => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (
          !lead.fullName.toLowerCase().includes(s) &&
          !lead.email?.toLowerCase().includes(s) &&
          !lead.companyName?.toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      if (filters.status && lead.status !== filters.status) return false;
      if (filters.source && lead.source !== filters.source) return false;
      if (filters.priority && lead.priority !== filters.priority) return false;
      if (filters.assignedTo && lead.assignedTo !== filters.assignedTo) return false;
      return true;
    });
  },

  async create(data: LeadFormData): Promise<Lead> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const dbRow = {
        ...mapLeadToDb(data),
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      };
      const { data: inserted, error } = await supabase
        .from('leads')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(formatSupabaseError(error));
      return mapRowToLead(inserted as DbLead);
    }
    const newLead: Lead = {
      ...data,
      id: `lead-${generateId().slice(0, 8)}`,
      tags: data.tags || [],
      estimatedValue: data.estimatedValue || 0,
      createdAt: now,
      updatedAt: now,
    };
    mockLeads.unshift(newLead);
    addLocalActivity('lead', newLead.id, 'created', `Lead created: ${newLead.fullName}${newLead.companyName ? ` from ${newLead.companyName}` : ''}`, {
      source: newLead.source,
      value: newLead.estimatedValue,
    });
    return newLead;
  },

  async update(id: string, data: Partial<LeadFormData>): Promise<Lead | undefined> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const dbData = { ...mapLeadToDb(data), updated_at: now };
      const { data: updated, error } = await supabase
        .from('leads')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(formatSupabaseError(error));
      }
      return mapRowToLead(updated as DbLead);
    }
    const index = mockLeads.findIndex((l) => l.id === id);
    if (index === -1) return undefined;

    const oldStatus = mockLeads[index].status;
    const updated = {
      ...mockLeads[index],
      ...data,
      tags: data.tags ?? mockLeads[index].tags,
      updatedAt: now,
    };
    mockLeads[index] = updated;

    if (data.status && data.status !== oldStatus) {
      addLocalActivity('lead', id, 'status_changed', `Status changed: ${oldStatus} → ${data.status}`, {
        from: oldStatus,
        to: data.status,
      });
    }
    addLocalActivity('lead', id, 'updated', `Lead updated: ${updated.fullName}`);
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw new Error(formatSupabaseError(error));
      return true;
    }
    const index = mockLeads.findIndex((l) => l.id === id);
    if (index === -1) return false;
    const deleted = mockLeads[index];
    mockLeads.splice(index, 1);
    addLocalActivity('lead', id, 'deleted', `Lead deleted: ${deleted.fullName}`);
    return true;
  },

  async updateStatus(id: string, status: Lead['status']): Promise<Lead | undefined> {
    return this.update(id, { status });
  },

  async getPipelineStats(): Promise<Record<Lead['status'], { count: number; value: number }>> {
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
  },

  async getDashboardKPIs(): Promise<{
    totalLeads: number;
    activeDeals: number;
    wonDeals: number;
    revenueEstimate: number;
    pipelineValue: number;
  }> {
    const allLeads = await this.getAll();
    const totalLeads = allLeads.length;
    const activeDeals = allLeads.filter((l) => !['won', 'lost'].includes(l.status)).length;
    const wonDeals = allLeads.filter((l) => l.status === 'won').length;
    const revenueEstimate = allLeads
      .filter((l) => l.status === 'won')
      .reduce((sum, l) => sum + l.estimatedValue, 0);
    const pipelineValue = allLeads
      .filter((l) => !['won', 'lost'].includes(l.status))
      .reduce((sum, l) => sum + l.estimatedValue, 0);

    return { totalLeads, activeDeals, wonDeals, revenueEstimate, pipelineValue };
  },
};
