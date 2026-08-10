import { getSharedClient, type SharedSupabaseClient } from '@/lib/supabase/client';
import type { Goal, GoalFormData, GoalType } from '@/types/goal.types';
import type { DbDeal, DbGoal, GoalInsert, GoalUpdate } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';
import { dealService } from './deal.service';

function safeNumber(val: unknown, fallback: number = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
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

/**
 * Result of a progress recalculation — the derived `current` value plus the
 * clamped 0-100 bar percentage (`getProgress` evaluated on the new current).
 */
export interface GoalProgressResult {
  current: number;
  progress: number;
}

interface PeriodWindow {
  start: string;
  end: string;
}

/** Distinguishes the DB insert shape (snake_case) from the form shape (camelCase). */
function isGoalInsert(data: GoalInsert | GoalFormData): data is GoalInsert {
  return 'start_date' in data;
}

/**
 * Builds an inclusive [start, end] window from a goal's ISO date range.
 * Date-only end values ('2026-12-31') are extended to the end of that day so
 * records created/completed during the final day are included.
 */
function periodWindow(goal: Goal): PeriodWindow {
  const startMs = new Date(goal.startDate).getTime();
  const endMs = new Date(goal.endDate).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new ServiceError(`Goal period dates are invalid: ${goal.startDate} — ${goal.endDate}`);
  }
  const end = /^\d{4}-\d{2}-\d{2}$/.test(goal.endDate)
    ? new Date(endMs + 86_399_999)
    : new Date(endMs);
  return { start: new Date(startMs).toISOString(), end: end.toISOString() };
}

/**
 * Fetches deals currently in a "won" stage (stage name contains "won" — the
 * pipeline's own definition, deal.service 'Closed Won'), restricted to the
 * goal's period. Won revenue is attributed to close_date (falling back to
 * created_at when no close date is set).
 */
async function fetchWonDealsInWindow(supabase: SharedSupabaseClient, window: PeriodWindow): Promise<DbDeal[]> {
  const stages = await dealService.getStages();
  const wonStageIds = stages
    .filter((s) => s.name.toLowerCase().includes('won'))
    .map((s) => s.id);
  if (wonStageIds.length === 0) return [];
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .in('stage_id', wonStageIds);
  if (error) throw toServiceError(error);
  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);
  const deals = (data ?? []).map((deal: DbDeal) => deal);
  console.log("===============", deals)


  return deals.filter((deal) => {
    const attributed = deal.close_date ?? deal.created_at;
    const t = Date.parse(attributed);
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
}

/**
 * Derives a goal's `current` from live CRM data, scoped by the goal's period:
 * revenue → won-deal value; deals_count → won deals; leads_created → leads;
 * tasks_completed → completed tasks (completion bumps updated_at — the closest
 * completion timestamp available); calls_made → call_logs. 'custom' goals keep
 * their stored value and are handled by the caller before this dispatch.
 */
/*async function computeCurrentForGoal(type: GoalType, window: PeriodWindow): Promise<number> {
  const supabase = await getSharedClient();
  switch (type) {
    case 'revenue': {
      const deals = await fetchWonDealsInWindow(supabase, window);
      return deals.reduce((sum, deal) => sum + safeNumber(deal.value), 0);
    }
    case 'deals_count': {
      const deals = await fetchWonDealsInWindow(supabase, window);
      return deals.length;
    }
    case 'leads_created': {
      const { count, error } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', window.start)
        .lte('created_at', window.end);
      if (error) throw toServiceError(error);
      return count ?? 0;
    }
    case 'tasks_completed': {
      const { count, error } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', window.start)
        .lte('updated_at', window.end);
      if (error) throw toServiceError(error);
      return count ?? 0;
    }
    case 'calls_made': {
      const { count, error } = await supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', window.start)
        .lte('created_at', window.end);
      if (error) throw toServiceError(error);
      return count ?? 0;
    }
    case 'custom':
      return 0; // unreachable — the caller short-circuits custom goals
  }
}*/

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

  /**
   * Two accepted shapes: the raw DB insert (snake_case, used by the hooks,
   * which supply created_by) and the documented `GoalFormData` (camelCase),
   * which is mapped to an insert and resolves created_by from the session.
   */

  async create(data: GoalInsert | GoalFormData): Promise<Goal> {
    try {
      const supabase = await getSharedClient();
      let insert: GoalInsert;
      if (isGoalInsert(data)) {
        insert = data;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        insert = {
          title: data.title,
          description: data.description,
          type: data.type,
          target: data.target,
          current: data.current,
          period: data.period,
          start_date: data.startDate,
          end_date: data.endDate,
          assigned_to: data.assignedTo ?? null,
          created_by: user?.id ?? 'system',
        };
      }
      const { data: inserted, error } = await supabase
        .from('goals')
        .insert(insert)
        .select()
        .single();
      if (error) throw toServiceError(error);
      return mapRow(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Returns `undefined` when the goal does not exist (PGRST116), matching the
   * other entity services; throws ServiceError only on real failures.
   */
  async update(id: string, data: GoalUpdate): Promise<Goal | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data: updated, error } = await supabase
        .from('goals')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
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

  /**
   * Bar percentage (0-100) for a goal. Clamped so a negative or overflowing
   * `current` can never render a negative width; 0 when the target is not a
   * finite positive number. Raw `current`/`target` stay exposed on the Goal.
   */
  getProgress(goal: Goal): number {
    if (!Number.isFinite(goal.target) || goal.target <= 0) return 0;
    const pct = Math.round((goal.current / goal.target) * 100);
    if (!Number.isFinite(pct)) return 0;
    return Math.max(0, Math.min(100, pct));
  },

  /**
   * Computes `current` from REAL CRM data per goal type (period-scoped):
   * revenue → won-deal value; deals_count → won deals; leads_created → leads;
   * tasks_completed → completed tasks; calls_made → call_logs; custom → the
   * stored value. Read-only — never writes to the DB (F27 wires it to a
   * "Recalculate" button + on-load display; no write-on-read anti-pattern).
   */




  async recalculateProgress(goal: Goal): Promise<GoalProgressResult> {

    try {
      if (goal.type === 'custom') {
        const current = safeNumber(goal.current);
        return { current, progress: this.getProgress({ ...goal, current }) };
      }
      const window = periodWindow(goal);
      const current = await computeCurrentForGoal(goal.type, window);
      return { current, progress: this.getProgress({ ...goal, current }) };
    } catch (e) {
      throw toServiceError(e);
    }

  },
};
