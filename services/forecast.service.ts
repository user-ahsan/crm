import { getSharedClient } from '@/lib/supabase/client';
import type { Forecast, ForecastSummary } from '@/types/forecast.types';
import type { DbForecast, ForecastInsert, ForecastUpdate } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';

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
      const { data: result, error } = await supabase
        .from('forecasts')
        .upsert({
          year: data.year,
          month: data.month,
          target: safeNumber(data.target),
          actual: safeNumber(data.actual),
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
    const months = await this.getForecasts(year);
    const totalTarget = months.reduce((sum, m) => sum + m.target, 0);
    const totalActual = months.reduce((sum, m) => sum + m.actual, 0);
    const achievement = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
    return { year, totalTarget, totalActual, achievement, months };
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
        achievement: totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0,
      }));
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
