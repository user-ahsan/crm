import { getSharedClient } from '@/lib/supabase/client';
import type { Goal } from '@/types/goal.types';
import type { DbGoal, GoalInsert, GoalUpdate } from '@/types/supabase.types';
import { toServiceError } from './supabase.service';

function mapRow(row: DbGoal): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    target: Number(row.target),
    current: Number(row.current),
    period: row.period,
    startDate: row.start_date,
    endDate: row.end_date,
    assignedTo: row.assigned_to ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const goalService = {
  async getAll(page = 1, pageSize = 50): Promise<Goal[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      return data?.map(mapRow) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getById(id: string): Promise<Goal | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data ? mapRow(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async create(data: GoalInsert): Promise<Goal> {
    try {
      const supabase = await getSharedClient();
      const { data: inserted, error } = await supabase
        .from('goals')
        .insert(data)
        .select()
        .single();
      if (error) throw toServiceError(error);
      return mapRow(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async update(id: string, data: GoalUpdate): Promise<Goal> {
    try {
      const supabase = await getSharedClient();
      const { data: updated, error } = await supabase
        .from('goals')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw toServiceError(error);
      return mapRow(updated);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getByPeriod(period: string, startDate?: string, endDate?: string): Promise<Goal[]> {
    try {
      const supabase = await getSharedClient();
      let query = supabase.from('goals').select('*').eq('period', period);
      if (startDate) query = query.gte('start_date', startDate);
      if (endDate) query = query.lte('end_date', endDate);
      const { data, error } = await query.order('end_date', { ascending: true });
      if (error) throw toServiceError(error);
      return data?.map(mapRow) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  getProgress(goal: Goal): number {
    if (goal.target <= 0) return 0;
    return Math.min(Math.round((goal.current / goal.target) * 100), 100);
  },
};
