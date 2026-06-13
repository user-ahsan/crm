import { createClient } from '@/lib/supabase/client';
import type { Company, CompanyFormData } from '@/types/company.types';
import type { DbCompany } from '@/types/supabase.types';
import { formatSupabaseError, addLocalActivity } from './supabase.service';

function mapRowToCompany(row: DbCompany): Company {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry ?? undefined,
    size: row.size as Company['size'] | undefined,
    revenue: row.revenue,
    location: row.location ?? undefined,
    website: row.website ?? undefined,
    contactIds: row.contact_ids ?? [],
    leadIds: row.lead_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCompanyToDb(company: Partial<CompanyFormData>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (company.name !== undefined) db.name = company.name;
  if (company.industry !== undefined) db.industry = company.industry || null;
  if (company.size !== undefined) db.size = company.size || null;
  if (company.revenue !== undefined) db.revenue = company.revenue;
  if (company.location !== undefined) db.location = company.location || null;
  if (company.website !== undefined) db.website = company.website || null;
  return db;
}

export const companyService = {
  async getAll(): Promise<Company[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbCompany[] | null)?.map(mapRowToCompany) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to fetch companies');
    }
  },

  async getById(id: string): Promise<Company | undefined> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapRowToCompany(data as DbCompany) : undefined;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch company ${id}`);
    }
  },

  async search(query: string): Promise<Company[]> {
    try {
      const supabase = await createClient();
      const s = query.toLowerCase();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .or(`name.ilike.%${s}%,industry.ilike.%${s}%,location.ilike.%${s}%`)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbCompany[] | null)?.map(mapRowToCompany) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to search companies');
    }
  },

  async create(data: CompanyFormData): Promise<Company> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();
      const dbRow = {
        ...mapCompanyToDb(data),
        contact_ids: [],
        lead_ids: [],
        created_at: now,
        updated_at: now,
      };
      const { data: inserted, error } = await supabase
        .from('companies')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const company = mapRowToCompany(inserted as DbCompany);
      addLocalActivity('company', company.id, 'created', `Company created: ${company.name}`);
      return company;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to create company');
    }
  },

  async update(id: string, data: Partial<CompanyFormData>): Promise<Company | undefined> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();
      const dbData = { ...mapCompanyToDb(data), updated_at: now };
      const { data: updated, error } = await supabase
        .from('companies')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      const company = mapRowToCompany(updated as DbCompany);
      addLocalActivity('company', id, 'updated', `Company updated: ${company.name}`);
      return company;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to update company ${id}`);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw new Error(error.message);
      addLocalActivity('company', id, 'deleted', `Company deleted`);
      return true;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to delete company ${id}`);
    }
  },

  async getRevenueEstimate(): Promise<number> {
    try {
      const all = await this.getAll();
      return all.reduce((sum, c) => sum + c.revenue, 0);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to calculate revenue estimate');
    }
  },
};
