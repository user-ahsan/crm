import { getSharedClient } from '@/lib/supabase/client';
import type { Company, CompanyFilters, CompanyFormData } from '@/types/company.types';
import type { DbCompany, DbContact, CompanyInsert } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';
import { activityService } from './activity.service';
import { automationService } from './automation.service';
import { triggerWebhook } from './webhook.service';
import { DUPE_WEIGHT_NAME_EXACT, DUPE_WEIGHT_NAME_PARTIAL, DUPE_WEIGHT_WEBSITE, DUPE_WEIGHT_INDUSTRY, DUPE_MIN_SCORE } from '@/lib/constants';

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
    size: row.size ?? undefined,
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
      if (error) throw toServiceError(error);
      return data?.map(mapRowToCompany) ?? [];
    } catch (e) {
      throw toServiceError(e);
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
        throw toServiceError(error);
      }
      return data ? mapRowToCompany(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Filtered company list (SERVICES.md:82 contract). AND semantics:
   * search = case-insensitive substring on name, industry = exact,
   * size = exact. `search` is aliased below for backward compatibility.
   */
  async getFiltered(filters: CompanyFilters, page = 1, pageSize = 50): Promise<Company[]> {
    try {
      const supabase = await getSharedClient();
      let query = supabase.from('companies').select('*');
      const search = filters.search?.trim();
      if (search) {
        query = query.ilike('name', `%${search.toLowerCase()}%`);
      }
      const industry = filters.industry?.trim();
      if (industry) {
        query = query.eq('industry', industry);
      }
      if (filters.size && filters.size !== '') {
        query = query.eq('size', filters.size);
      }
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      return data?.map(mapRowToCompany) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /** Backward-compatible alias of getFiltered — searches companies by name. */
  async search(query: string, page = 1, pageSize = 50): Promise<Company[]> {
    return this.getFiltered({ search: query }, page, pageSize);
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
      if (error) throw toServiceError(error);
      const company = mapRowToCompany(inserted);
      activityService.log('company', company.id, 'created', `Company created: ${company.name}`);
      triggerWebhook('company.created', {
        id: company.id,
        name: company.name,
        industry: company.industry,
        revenue: company.revenue,
      });
      await automationService.evaluate('company.created', {
        entityType: 'company',
        entityId: company.id,
        name: company.name,
        industry: company.industry,
        revenue: company.revenue,
      });
      return company;
    } catch (e) {
      throw toServiceError(e);
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
        throw toServiceError(error);
      }
      const company = mapRowToCompany(updated);
      activityService.log('company', id, 'updated', `Company updated: ${company.name}`);
      triggerWebhook('company.updated', { id, ...data });
      await automationService.evaluate('company.updated', {
        entityType: 'company',
        entityId: id,
        ...data,
      });
      return company;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      // Cascade cleanups are scoped by related_to_type / entity_type (C16) so
      // a company id never removes another entity's records. Contacts, deals
      // and invoices are NOT hard-deleted — their company_id link is nulled
      // instead. Leads have no company_id column (schema-verified); their only
      // company link is the denormalized companies.lead_ids array, which dies
      // with this row. Any cascade failure aborts the delete so no orphaned
      // related records are left behind.
      const ops = [
        supabase.from('tasks').delete().eq('related_to_type', 'company').eq('related_to_id', id),
        supabase.from('meetings').delete().eq('related_to_type', 'company').eq('related_to_id', id),
        supabase.from('activities').delete().eq('entity_type', 'company').eq('entity_id', id),
        supabase.from('contacts').update({ company_id: null }).eq('company_id', id),
        supabase.from('deals').update({ company_id: null }).eq('company_id', id),
        supabase.from('invoices').update({ company_id: null }).eq('company_id', id),
      ];
      const results = await Promise.all(ops);
      for (const result of results) {
        if (result.error) {
          throw new ServiceError(
            `Failed to clean up related records before deleting company ${id}: ${result.error.message}`,
            'CASCADE_DELETE_FAILED',
          );
        }
      }
      const { data: deletedRows, error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) throw toServiceError(error);
      if (!deletedRows || deletedRows.length === 0) return false;
      activityService.log('company', id, 'deleted', 'Company deleted');
      triggerWebhook('company.deleted', { id });
      await automationService.evaluate('company.deleted', {
        entityType: 'company',
        entityId: id,
      });
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Full-scan duplicate detection with weighted name/website/industry scoring.
   * Threshold weights come from lib/constants.ts (DUPE_WEIGHT_* / DUPE_MIN_SCORE);
   * the Data Quality page exposes the same weights via its similarity UI.
   */
  async findDuplicates(threshold?: number): Promise<DuplicateGroup[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw toServiceError(error);
      const all = (data ?? []).map(mapRowToCompany);
      const minScore = threshold ?? DUPE_MIN_SCORE;

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
            score += DUPE_WEIGHT_NAME_EXACT;
          } else if (a.name && b.name) {
            const na = a.name.toLowerCase().trim();
            const nb = b.name.toLowerCase().trim();
            if ((na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 3) {
              score += DUPE_WEIGHT_NAME_PARTIAL;
            }
          }
          if (a.website && b.website) {
            const wa = a.website.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
            const wb = b.website.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
            if (wa === wb) {
              score += DUPE_WEIGHT_WEBSITE;
            }
          }
          if (a.industry && b.industry && a.industry.toLowerCase() === b.industry.toLowerCase()) {
            score += DUPE_WEIGHT_INDUSTRY;
          }

          if (score >= minScore) {
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
      throw toServiceError(e);
    }
  },

  async merge(survivorId: string, mergeIds: string[]): Promise<Company> {
    try {
      const supabase = await getSharedClient();

      const existingSurvivor = await this.getById(survivorId);
      if (!existingSurvivor) throw new ServiceError('Survivor company not found', 'MERGE_FAILED');
      const survivorLeadIds = existingSurvivor.leadIds;

      // Capture the merged-away companies' lead linkages BEFORE deleting them —
      // the leads table has no company_id, so companies.lead_ids is the only
      // lead→company link to preserve onto the survivor.
      const { data: mergedRows, error: mergedErr } = await supabase
        .from('companies')
        .select('id, lead_ids')
        .in('id', mergeIds);
      if (mergedErr) throw toServiceError(mergedErr);
      const mergedLeadIds = (mergedRows ?? []).reduce<string[]>(
        (acc, row: DbCompany) => acc.concat(row.lead_ids ?? []),
        [],
      );

      // Repoint related records to the survivor (scoped by entity type — C16).
      const repointOps = [
        supabase.from('tasks').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'company'),
        supabase.from('meetings').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'company'),
        supabase.from('activities').update({ entity_id: survivorId }).in('entity_id', mergeIds).eq('entity_type', 'company'),
        supabase.from('taggings').update({ taggable_id: survivorId }).in('taggable_id', mergeIds).eq('taggable_type', 'company'),
        supabase.from('contacts').update({ company_id: survivorId }).in('company_id', mergeIds),
      ];
      const repointResults = await Promise.all(repointOps);
      for (const result of repointResults) {
        if (result.error) {
          throw new ServiceError(
            `Failed to merge related records into company ${survivorId}: ${result.error.message}`,
            'MERGE_REPOINT_FAILED',
          );
        }
      }

      for (const id of mergeIds) {
        const deleted = await this.delete(id);
        if (!deleted) throw new ServiceError(`Company ${id} not found during merge`, 'MERGE_FAILED');
      }

      // Rebuild the survivor's denormalized arrays from actual rows so the
      // company detail's Contacts/Leads tabs reflect every repointed record.
      const { data: linkedContacts, error: contactsQueryErr } = await supabase
        .from('contacts')
        .select('id')
        .eq('company_id', survivorId);
      if (contactsQueryErr) throw toServiceError(contactsQueryErr);
      const contactIds = (linkedContacts ?? []).map((row: DbContact) => row.id);
      const leadIds = Array.from(new Set([...survivorLeadIds, ...mergedLeadIds]));

      const { data: updatedSurvivor, error: updateErr } = await supabase
        .from('companies')
        .update({ contact_ids: contactIds, lead_ids: leadIds })
        .eq('id', survivorId)
        .select()
        .single();
      if (updateErr) throw toServiceError(updateErr);

      const survivor = mapRowToCompany(updatedSurvivor);
      activityService.log('company', survivorId, 'updated', `Company merged: merged ${mergeIds.length} duplicates`);
      return survivor;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Total annual revenue across all companies. Not called by any current UI —
   * kept for the dashboard revenue-estimation surface (FEATURES.md feature 3).
   */
  async getRevenueEstimate(): Promise<number> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('companies')
        .select('*');
      if (error) throw toServiceError(error);
      const rows = data ?? [];
      return rows.reduce((sum: number, row: DbCompany) => sum + (row.revenue ?? 0), 0);
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
