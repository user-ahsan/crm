import { createClient } from '@/lib/supabase/client';
import type { Forecast, ForecastSummary } from '@/types/forecast.types';
import type { DbForecast, ForecastInsert, ForecastUpdate } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

let _client: Awaited<ReturnType<typeof createClient>> | null = null;
async function getClient() {
  if (!_client) _client = await createClient();
  return _client;
}

function mapRow(row: DbForecast): Forecast {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    target: Number(row.target),
    actual: Number(row.actual),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const forecastService = {
  async getForecasts(year: number): Promise<Forecast[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('forecasts')
        .select('*')
        .eq('year', year)
        .order('month', { ascending: true });
      if (error) throw new Error(error.message);
      return data?.map(mapRow) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async upsert(data: ForecastInsert): Promise<Forecast> {
    try {
      const supabase = await getClient();
      const { data: existing } = await supabase
        .from('forecasts')
        .select('id')
        .eq('year', data.year)
        .eq('month', data.month)
        .eq('created_by', data.created_by)
        .maybeSingle();

      let result: DbForecast;
      if (existing) {
        const update: ForecastUpdate = {};
        if (data.target !== undefined) update.target = data.target;
        if (data.actual !== undefined) update.actual = data.actual;
        const { data: updated, error } = await supabase
          .from('forecasts')
          .update(update)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        result = updated;
      } else {
        const { data: inserted, error } = await supabase
          .from('forecasts')
          .insert(data)
          .select()
          .single();
        if (error) throw new Error(error.message);
        result = inserted;
      }
      return mapRow(result);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getSummary(year: number): Promise<ForecastSummary> {
    const months = await this.getForecasts(year);
    const totalTarget = months.reduce((sum, m) => sum + m.target, 0);
    const totalActual = months.reduce((sum, m) => sum + m.actual, 0);
    const achievement = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
    return { year, totalTarget, totalActual, achievement, months };
  },

  async getYearly(): Promise<{ year: number; totalTarget: number; totalActual: number; achievement: number }[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('forecasts')
        .select('*')
        .order('year', { ascending: false });
      if (error) throw new Error(error.message);
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
        achievement: totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0,
      }));
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
