'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Forecast, ForecastSummary } from '@/types/forecast.types';
import type { ForecastInsert } from '@/types/supabase.types';
import { forecastService } from '@/services/forecast.service';
import { generateId } from '@/lib/formatters';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useForecasts(year?: number) {
  const { user } = useCurrentUser();
  const currentYear = year ?? new Date().getFullYear();
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await forecastService.getSummary(currentYear);
      setForecasts(s.months);
      setSummary(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load forecasts');
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await forecastService.getSummary(currentYear);
        if (!cancelled) {
          setForecasts(s.months);
          setSummary(s);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load forecasts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentYear]);

  const upsert = useCallback(async (data: Omit<ForecastInsert, 'created_by'>) => {
    if (!user?.id) {
      setError('User not authenticated');
      return undefined;
    }
    let prevItem: Forecast | undefined;
    const optimistic = {
      id: generateId(),
      year: data.year,
      month: data.month,
      target: data.target ?? 0,
      actual: data.actual ?? 0,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setForecasts((prev) => {
      const idx = prev.findIndex((f) => f.month === data.month);
      if (idx >= 0) {
        prevItem = prev[idx];
        const next = [...prev];
        next[idx] = { ...next[idx], ...optimistic };
        return next;
      }
      return [...prev, optimistic];
    });
    try {
      const created = await forecastService.upsert({ ...data, created_by: user.id });
      setForecasts((prev) => prev.map((f) => (f.id === optimistic.id || f.month === data.month ? { ...created } : f)));
      return created;
    } catch (e) {
      if (prevItem) setForecasts((prev) => prev.map((f) => (f.month === data.month ? prevItem! : f)));
      setError(e instanceof Error ? e.message : 'Failed to save forecast');
      return undefined;
    }
  }, [user]);

  return { forecasts, summary, loading, error, upsert, refresh };
}
