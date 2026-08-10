'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Forecast, ForecastSummary } from '@/types/forecast.types';
import type { ForecastInsert } from '@/types/supabase.types';
import { forecastService } from '@/services/forecast.service';
import { generateId } from '@/lib/formatters';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/**
 * Mirrors forecastService.getSummary's aggregate math (rounding, >100
 * overachievement allowed, clamped ≥ 0, 0 when no target) so a successful
 * single-cell upsert can refresh the summary card locally without a full
 * refetch (P2 stale-summary fix).
 */
function buildSummary(year: number, months: Forecast[]): ForecastSummary {
  const totalTarget = months.reduce((sum, m) => sum + m.target, 0);
  const totalActual = months.reduce((sum, m) => sum + m.actual, 0);
  const achievement =
    Number.isFinite(totalTarget) && totalTarget > 0
      ? Math.max(0, Math.round((totalActual / totalTarget) * 100))
      : 0;
  return { year, totalTarget, totalActual, achievement, months };
}

export function useForecasts(year?: number) {
  const { user } = useCurrentUser();
  const currentYear = year ?? new Date().getFullYear();
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Latest rendered list — read synchronously by upsert for rollback and
  // summary recompute. Never capture previous state inside a state updater
  // (updaters may run deferred; the audit flagged that as a rollback no-op).
  const forecastsRef = useRef<Forecast[]>([]);
  useEffect(() => {
    forecastsRef.current = forecasts;
  }, [forecasts]);

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
    const prevList = forecastsRef.current;
    const prevItem = prevList.find((f) => f.month === data.month);
    const optimistic: Forecast = {
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
        const next = [...prev];
        next[idx] = { ...next[idx], ...optimistic };
        return next;
      }
      return [...prev, optimistic];
    });
    try {
      const created = await forecastService.upsert({ ...data, created_by: user.id });
      // Merge the persisted row into the latest rendered list (matched by
      // optimistic id OR month — covers both new-month and existing-month
      // upserts), then recompute the summary locally so the summary card
      // reflects the edit without a full refetch (F16/P2 stale-summary fix).
      const merged = prevList.map((f) =>
        f.id === optimistic.id || f.month === data.month ? created : f,
      );
      if (!merged.some((f) => f.month === data.month)) {
        merged.push(created);
      }
      merged.sort((a, b) => a.month - b.month);
      setForecasts(merged);
      setSummary(buildSummary(currentYear, merged));
      return created;
    } catch (e) {
      // C13: a failed upsert must NEVER leave a phantom optimistic row. When
      // the month existed, restore the previous row; when it was new, remove
      // the optimistic id entirely.
      setForecasts((prev) =>
        prevItem
          ? prev.map((f) => (f.month === data.month ? prevItem : f))
          : prev.filter((f) => f.id !== optimistic.id),
      );
      setError(e instanceof Error ? e.message : 'Failed to save forecast');
      return undefined;
    }
  }, [user, currentYear]);

  /**
   * Recomputes each month's `actual` from the value of won deals via
   * forecastService.recalculateActuals (FEATURES §16 "auto-calculated from
   * won deals"). Replaces the manual won-leads loop the page used to run.
   * Returns the refreshed summary on success; undefined on failure (error
   * state is also set for the page to surface).
   */
  const recalculate = useCallback(async (): Promise<ForecastSummary | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const s = await forecastService.recalculateActuals(currentYear);
      setForecasts(s.months);
      setSummary(s);
      return s;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to recalculate actuals';
      setError(msg);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  return { forecasts, summary, loading, error, upsert, refresh, recalculate };
}
