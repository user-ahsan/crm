import { getSharedClient } from '@/lib/supabase/client';
import type { Company, CompanyFormData } from '@/types/company.types';
import type { DbCompany, CompanyInsert } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';

interface DuplicateGroup {
  item: Company;
  duplicates: Company[];
  score: number;
}

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
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCompanyToDb(company: Partial<CompanyFormData>): Partial<CompanyInsert> {
  const db: Partial<CompanyInsert> = {};
  if (company.name !== undefined) db.name = company.name;
  if (company.industry !== undefined) db.industry = company.industry || null;
  if (company.size !== undefined) db.size = company.size || null;
  if (company.revenue !== undefined) db.revenue = company.revenue;
  if (company.location !== undefined) db.location = company.location || null;
  if (company.website !== undefined) db.website = company.website || null;
  if (company.tags !== undefined) db.tags = company.tags;
  return db;
}

export const companyService = {
  async getAll(page = 1, pageSize = 50): Promise<Company[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToCompany) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getById(id: string): Promise<Company | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapRowToCompany(data) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async search(query: string, page = 1, pageSize = 50): Promise<Company[]> {
    try {
      const supabase = await getSharedClient();
      const s = query.toLowerCase();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .or(`name.ilike.%${s}%,industry.ilike.%${s}%,location.ilike.%${s}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToCompany) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async create(data: CompanyFormData): Promise<Company> {
    try {
      const supabase = await getSharedClient();
      const dbRow = {
        ...mapCompanyToDb(data),
        contact_ids: [],
        lead_ids: [],
      };
      const { data: inserted, error } = await supabase
        .from('companies')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const company = mapRowToCompany(inserted);
      activityService.log('company', company.id, 'created', `Company created: ${company.name}`);
      triggerWebhook('company.created', {
        id: company.id,
        name: company.name,
        industry: company.industry,
        revenue: company.revenue,
      });
      return company;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async update(id: string, data: Partial<CompanyFormData>): Promise<Company | undefined> {
    try {
      const supabase = await getSharedClient();
      const dbData = { ...mapCompanyToDb(data) };
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
      const company = mapRowToCompany(updated);
      activityService.log('company', id, 'updated', `Company updated: ${company.name}`);
      triggerWebhook('company.updated', { id, ...data });
      return company;
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
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw new Error(error.message);
      activityService.log('company', id, 'deleted', `Company deleted`);
      triggerWebhook('company.deleted', { id });
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async findDuplicates(): Promise<DuplicateGroup[]> {
    try {
      const all = await this.getAll();
      const groups: DuplicateGroup[] = [];
      const visited = new Set<string>();

      for (let i = 0; i < all.length; i++) {
        if (visited.has(all[i].id)) continue;
        const a = all[i];
        const matches: Company[] = [];
        let maxScore = 0;

        for (let j = i + 1; j < all.length; j++) {
          const b = all[j];
          if (visited.has(b.id)) continue;
          let score = 0;

          if (a.name && b.name && a.name.toLowerCase() === b.name.toLowerCase()) {
            score += 40;
          } else if (a.name && b.name) {
            const na = a.name.toLowerCase().trim();
            const nb = b.name.toLowerCase().trim();
            if ((na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 3) {
              score += 20;
            }
          }
          if (a.website && b.website && a.website.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') === b.website.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')) {
            score += 35;
          }
          if (a.industry && b.industry && a.industry.toLowerCase() === b.industry.toLowerCase()) {
            score += 10;
          }

          if (score >= 20) {
            matches.push(b);
            if (score > maxScore) maxScore = score;
          }
        }

        if (matches.length > 0) {
          groups.push({ item: a, duplicates: matches, score: maxScore });
          for (const m of matches) visited.add(m.id);
          visited.add(a.id);
        }
      }

      return groups.sort((a, b) => b.score - a.score);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async merge(survivorId: string, mergeIds: string[]): Promise<Company> {
    try {
      const supabase = await getSharedClient();

      await supabase.from('tasks').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'company');
      await supabase.from('meetings').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'company');
      await supabase.from('activities').update({ entity_id: survivorId }).in('entity_id', mergeIds);
      await supabase.from('taggings').update({ taggable_id: survivorId }).in('taggable_id', mergeIds).eq('taggable_type', 'company');
      await supabase.from('contacts').update({ company_id: survivorId }).in('company_id', mergeIds);

      for (const id of mergeIds) {
        await this.delete(id);
      }

      const survivor = await this.getById(survivorId);
      if (!survivor) throw new Error('Survivor company not found after merge');
      activityService.log('company', survivorId, 'updated', `Company merged: merged ${mergeIds.length} duplicates`);
      return survivor;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getRevenueEstimate(): Promise<number> {
    try {
      const all = await this.getAll();
      return all.reduce((sum, c) => sum + c.revenue, 0);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
