import { getSharedClient } from '@/lib/supabase/client';
import type { Forecast, ForecastSummary } from '@/types/forecast.types';
import type { DbDeal, DbForecast, ForecastInsert } from '@/types/supabase.types';
import { toServiceError } from './supabase.service';
import { dealService } from './deal.service';

function safeNumber(val: unknown, fallback: number = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function mapRow(row: DbForecast): Forecast {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    target: safeNumber(row.target),
    actual: safeNumber(row.actual),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Rounds the achievement percentage. Values above 100 are allowed
 * (overachievement is a real, useful signal for managers) and the result is
 * never negative; when there is no target (or the target is not a finite
 * positive number) achievement is 0.
 */
function computeAchievement(totalActual: number, totalTarget: number): number {
  if (!Number.isFinite(totalTarget) || totalTarget <= 0) return 0;
  const pct = Math.round((totalActual / totalTarget) * 100);
  return Number.isFinite(pct) ? Math.max(0, pct) : 0;
}

/**
 * Fetches deals currently in a "won" stage. The won signal mirrors the
 * pipeline's own definition (deal.service DEFAULT_DEAL_STAGES 'Closed Won'):
 * a stage whose normalized name contains "won". `dealService.getStages()` is
 * used so mock mode seeds the default stages before lookup (PATTERN-mock-mode
 * §4 — deal_stages has no seed; deal.service seeds via insert).
 */
async function fetchWonDeals(): Promise<DbDeal[]> {
  const supabase = await getSharedClient();
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
  return (data ?? []).map((deal: DbDeal) => deal);
}

export const forecastService = {
  async getForecasts(year: number): Promise<Forecast[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('forecasts')
        .select('*')
        .eq('year', year)
        .order('month', { ascending: true });
      if (error) throw toServiceError(error);
      return data?.map(mapRow) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async upsert(data: ForecastInsert): Promise<Forecast> {
    try {
      const supabase = await getSharedClient();
      // Preserve the existing month when the insert omits target/actual —
      // e.g. "Set Targets" writes only target and must not wipe a stored
      // actual (the previous safeNumber(undefined) → 0 did exactly that).
      const { data: existing } = await supabase
        .from('forecasts')
        .select('*')
        .eq('year', data.year)
        .eq('month', data.month)
        .eq('created_by', data.created_by)
        .maybeSingle();
      const target = data.target !== undefined ? safeNumber(data.target) : safeNumber(existing?.target, 0);
      const actual = data.actual !== undefined ? safeNumber(data.actual) : safeNumber(existing?.actual, 0);
      const { data: result, error } = await supabase
        .from('forecasts')
        .upsert({
          year: data.year,
          month: data.month,
          target,
          actual,
          created_by: data.created_by,
        }, {
          onConflict: 'year,month,created_by',
          ignoreDuplicates: false,
        })
        .select()
        .single();
      if (error) throw toServiceError(error);
      return mapRow(result);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getSummary(year: number): Promise<ForecastSummary> {
    // Always recomputed from the CURRENT forecasts table — never a cache —
    // so single-cell edits are reflected immediately (P2 stale-summary fix).
    const months = await this.getForecasts(year);
    const totalTarget = months.reduce((sum, m) => sum + m.target, 0);
    const totalActual = months.reduce((sum, m) => sum + m.actual, 0);
    return {
      year,
      totalTarget,
      totalActual,
      achievement: computeAchievement(totalActual, totalTarget),
      months,
    };
  },

  /**
   * Recomputes each month's `actual` from the VALUE of won deals (FEATURES §16
   * "auto-calculated from won deals"). Revenue is attributed to the month of
   * the deal's close_date (falling back to created_at when no close date is
   * set). All 12 months of the year are written — months with no won deals
   * get 0 — while targets are preserved, and existing (year, month) rows are
   * updated in place rather than forked under a second created_by.
   */
  async recalculateActuals(year: number): Promise<ForecastSummary> {
    try {
      const supabase = await getSharedClient();
      const deals = await fetchWonDeals();

      const actualByMonth = new Map<number, number>();
      for (const deal of deals) {
        const date = new Date(deal.close_date ?? deal.created_at);
        if (date.getFullYear() !== year) continue;
        const month = date.getMonth() + 1;
        actualByMonth.set(month, (actualByMonth.get(month) ?? 0) + safeNumber(deal.value));
      }

      // Reuse the created_by of existing rows so recalc updates in place
      // instead of creating a second (year, month) row under a new user.
      const { data: existingRows } = await supabase
        .from('forecasts')
        .select('*')
        .eq('year', year);
      const existingByMonth = new Map<number, Forecast>();
      for (const row of (existingRows ?? []).map((r: DbForecast) => mapRow(r))) {
        existingByMonth.set(row.month, row);
      }
      const { data: { user } } = await supabase.auth.getUser();
      const fallbackCreatedBy = user?.id ?? 'system';

      for (let month = 1; month <= 12; month += 1) {
        await this.upsert({
          year,
          month,
          actual: actualByMonth.get(month) ?? 0,
          created_by: existingByMonth.get(month)?.createdBy ?? fallbackCreatedBy,
        });
      }
      return await this.getSummary(year);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getYearly(): Promise<{ year: number; totalTarget: number; totalActual: number; achievement: number }[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('forecasts')
        .select('*')
        .order('year', { ascending: false });
      if (error) throw toServiceError(error);
      const rows = data?.map(mapRow) ?? [];
      const grouped = new Map<number, { totalTarget: number; totalActual: number }>();
      for (const r of rows) {
        const g = grouped.get(r.year) ?? { totalTarget: 0, totalActual: 0 };
        g.totalTarget += r.target;
        g.totalActual += r.actual;
        grouped.set(r.year, g);
      }
      return Array.from(grouped.entries()).map(([year, { totalTarget, totalActual }]) => ({
        year,
        totalTarget,
        totalActual,
        achievement: computeAchievement(totalActual, totalTarget),
      }));
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
