import { createClient } from '@/lib/supabase/client';
import type { Deal, DealFormData, DealStage, DealStageFormData } from '@/types/deal.types';
import type { DbDeal, DbDealStage } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';
import { activityService } from './activity.service';

function mapStageRow(row: DbDealStage): DealStage {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    probability: row.probability,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapDealRow(row: DbDeal, stage?: DealStage): Deal {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    value: row.value,
    currency: row.currency,
    stageId: row.stage_id ?? undefined,
    leadId: row.lead_id ?? undefined,
    contactId: row.contact_id ?? undefined,
    companyId: row.company_id ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    closeDate: row.close_date ?? undefined,
    winLossReason: row.win_loss_reason ?? '',
    tags: row.tags ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stage,
  };
}

function mapDealToDb(data: Partial<DealFormData>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (data.title !== undefined) db.title = data.title;
  if (data.description !== undefined) db.description = data.description || '';
  if (data.value !== undefined) db.value = data.value;
  if (data.currency !== undefined) db.currency = data.currency;
  if (data.stageId !== undefined) db.stage_id = data.stageId || null;
  if (data.leadId !== undefined) db.lead_id = data.leadId || null;
  if (data.contactId !== undefined) db.contact_id = data.contactId || null;
  if (data.companyId !== undefined) db.company_id = data.companyId || null;
  if (data.assignedTo !== undefined) db.assigned_to = data.assignedTo || null;
  if (data.closeDate !== undefined) db.close_date = data.closeDate || null;
  if (data.tags !== undefined) db.tags = data.tags;
  return db;
}

let _client: Awaited<ReturnType<typeof createClient>> | null = null;
async function getClient() {
  if (!_client) _client = await createClient();
  return _client;
}

export const dealService = {
  // ── Stages ────────────────────────────────────────────────

  async getStages(): Promise<DealStage[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('deal_stages')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw new Error(error.message);
      return data?.map(mapStageRow) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async createStage(data: DealStageFormData): Promise<DealStage> {
    try {
      const supabase = await getClient();
      const { data: inserted, error } = await supabase
        .from('deal_stages')
        .insert({
          name: data.name,
          color: data.color ?? '#6366f1',
          probability: data.probability ?? 0,
          sort_order: data.sortOrder ?? 0,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapStageRow(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async updateStage(id: string, data: Partial<DealStageFormData>): Promise<DealStage> {
    try {
      const supabase = await getClient();
      const dbData: Record<string, unknown> = {};
      if (data.name !== undefined) dbData.name = data.name;
      if (data.color !== undefined) dbData.color = data.color;
      if (data.probability !== undefined) dbData.probability = data.probability;
      if (data.sortOrder !== undefined) dbData.sort_order = data.sortOrder;
      const { data: updated, error } = await supabase
        .from('deal_stages')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapStageRow(updated);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async deleteStage(id: string): Promise<boolean> {
    try {
      const supabase = await getClient();
      const { error } = await supabase.from('deal_stages').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  // ── Deals ─────────────────────────────────────────────────

  async getAll(page = 1, pageSize = 50): Promise<Deal[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('deals')
        .select('*, deal_stages(*)')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map((row) => mapDealRow(row, row.deal_stages ? mapStageRow(row.deal_stages) : undefined)) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getById(id: string): Promise<Deal | undefined> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('deals')
        .select('*, deal_stages(*)')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapDealRow(data, data.deal_stages ? mapStageRow(data.deal_stages) : undefined) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async create(data: DealFormData): Promise<Deal> {
    try {
      const supabase = await getClient();
      const dbRow = {
        ...mapDealToDb(data),
        created_by: 'user-1',
      };
      const { data: inserted, error } = await supabase
        .from('deals')
        .insert(dbRow)
        .select('*, deal_stages(*)')
        .single();
      if (error) throw new Error(error.message);
      const deal = mapDealRow(inserted, inserted.deal_stages ? mapStageRow(inserted.deal_stages) : undefined);
      activityService.log('deal', deal.id, 'created', `Deal created: ${deal.title}`, { value: deal.value });
      return deal;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async update(id: string, data: Partial<DealFormData>): Promise<Deal | undefined> {
    try {
      const supabase = await getClient();
      const dbData = { ...mapDealToDb(data) };
      const { data: updated, error } = await supabase
        .from('deals')
        .update(dbData)
        .eq('id', id)
        .select('*, deal_stages(*)')
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      const deal = mapDealRow(updated, updated.deal_stages ? mapStageRow(updated.deal_stages) : undefined);
      activityService.log('deal', id, 'updated', `Deal updated: ${deal.title}`);
      return deal;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getClient();
      await supabase.from('quotes').delete().eq('deal_id', id);
      await supabase.from('activities').delete().eq('entity_id', id);
      const { error } = await supabase.from('deals').delete().eq('id', id);
      if (error) throw new Error(error.message);
      activityService.log('deal', id, 'deleted', `Deal deleted`);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getByStage(stageId: string): Promise<Deal[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('deals')
        .select('*, deal_stages(*)')
        .eq('stage_id', stageId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data?.map((row) => mapDealRow(row, row.deal_stages ? mapStageRow(row.deal_stages) : undefined)) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getPipeline(): Promise<{ stage: DealStage; deals: Deal[] }[]> {
    try {
      const stages = await this.getStages();
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('deals')
        .select('*, deal_stages(*)')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      const deals = data?.map((row) => mapDealRow(row, row.deal_stages ? mapStageRow(row.deal_stages) : undefined)) ?? [];
      return stages.map((stage) => ({
        stage,
        deals: deals.filter((d) => d.stageId === stage.id),
      }));
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getTotalValue(): Promise<number> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase.from('deals').select('value');
      if (error) throw new Error(error.message);
      return data?.reduce((sum, row) => sum + (row.value ?? 0), 0) ?? 0;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
