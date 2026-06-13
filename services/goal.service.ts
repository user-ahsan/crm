import { createClient } from '@/lib/supabase/client';
import type { Goal } from '@/types/goal.types';
import type { DbGoal, GoalInsert, GoalUpdate } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

let _client: Awaited<ReturnType<typeof createClient>> | null = null;
async function getClient() {
  if (!_client) _client = await createClient();
  return _client;
}

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
  async getAll(): Promise<Goal[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data?.map(mapRow) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getById(id: string): Promise<Goal | null> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      return data ? mapRow(data) : null;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async create(data: GoalInsert): Promise<Goal> {
    try {
      const supabase = await getClient();
      const { data: inserted, error } = await supabase
        .from('goals')
        .insert(data)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapRow(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async update(id: string, data: GoalUpdate): Promise<Goal> {
    try {
      const supabase = await getClient();
      const { data: updated, error } = await supabase
        .from('goals')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapRow(updated);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const supabase = await getClient();
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (error) throw new Error(error.message);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getByPeriod(period: string, startDate?: string, endDate?: string): Promise<Goal[]> {
    try {
      const supabase = await getClient();
      let query = supabase.from('goals').select('*').eq('period', period);
      if (startDate) query = query.gte('start_date', startDate);
      if (endDate) query = query.lte('end_date', endDate);
      const { data, error } = await query.order('end_date', { ascending: true });
      if (error) throw new Error(error.message);
      return data?.map(mapRow) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  getProgress(goal: Goal): number {
    if (goal.target <= 0) return 0;
    return Math.min(Math.round((goal.current / goal.target) * 100), 100);
  },
};
