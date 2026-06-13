import { companies as mockCompanies } from '@/data/companies';
import type { Company, CompanyFormData } from '@/types/company.types';
import type { DbCompany } from '@/types/supabase.types';
import { generateId } from '@/lib/formatters';
import { isSupabaseConfigured, getSupabaseClient as getSupabaseClientAsync, formatSupabaseError, addLocalActivity } from './supabase.service';

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
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbCompany[] | null)?.map(mapRowToCompany) ?? [];
    }
    return [...mockCompanies];
  },

  async getById(id: string): Promise<Company | undefined> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(formatSupabaseError(error));
      }
      return data ? mapRowToCompany(data as DbCompany) : undefined;
    }
    return mockCompanies.find((c) => c.id === id);
  },

  async search(query: string): Promise<Company[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const s = query.toLowerCase();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .or(`name.ilike.%${s}%,industry.ilike.%${s}%,location.ilike.%${s}%`)
        .order('created_at', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbCompany[] | null)?.map(mapRowToCompany) ?? [];
    }
    const s = query.toLowerCase();
    return mockCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.industry?.toLowerCase().includes(s) ||
        c.location?.toLowerCase().includes(s),
    );
  },

  async create(data: CompanyFormData): Promise<Company> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const dbRow = {
        ...mapCompanyToDb(data),
        id: crypto.randomUUID(),
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
      if (error) throw new Error(formatSupabaseError(error));
      return mapRowToCompany(inserted as DbCompany);
    }
    const newCompany: Company = {
      ...data,
      id: `company-${generateId().slice(0, 8)}`,
      contactIds: [],
      leadIds: [],
      createdAt: now,
      updatedAt: now,
    };
    mockCompanies.unshift(newCompany);
    addLocalActivity('company', newCompany.id, 'created', `Company created: ${newCompany.name}`);
    return newCompany;
  },

  async update(id: string, data: Partial<CompanyFormData>): Promise<Company | undefined> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const dbData = { ...mapCompanyToDb(data), updated_at: now };
      const { data: updated, error } = await supabase
        .from('companies')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(formatSupabaseError(error));
      }
      return mapRowToCompany(updated as DbCompany);
    }
    const index = mockCompanies.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    const updated = {
      ...mockCompanies[index],
      ...data,
      updatedAt: now,
    };
    mockCompanies[index] = updated;
    addLocalActivity('company', id, 'updated', `Company updated: ${updated.name}`);
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw new Error(formatSupabaseError(error));
      return true;
    }
    const index = mockCompanies.findIndex((c) => c.id === id);
    if (index === -1) return false;
    const deleted = mockCompanies[index];
    mockCompanies.splice(index, 1);
    addLocalActivity('company', id, 'deleted', `Company deleted: ${deleted.name}`);
    return true;
  },

  async getRevenueEstimate(): Promise<number> {
    if (isSupabaseConfigured()) {
      const all = await this.getAll();
      return all.reduce((sum, c) => sum + c.revenue, 0);
    }
    return mockCompanies.reduce((sum, c) => sum + c.revenue, 0);
  },
};
