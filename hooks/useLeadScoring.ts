'use client';

import { useState, useCallback, useEffect } from 'react';
import type { LeadScore } from '@/types/lead-scoring.types';
import { leadService } from '@/services/lead.service';

export function useLeadScore(leadId: string) {
  const [score, setScore] = useState<LeadScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await leadService.getScore(leadId);
      setScore(data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load score');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;
    leadService.getScore(leadId).then((data) => {
      if (!cancelled) setScore(data ?? null);
    }).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load score');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [leadId]);

  const recalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await leadService.updateScore(leadId);
      setScore(data);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to recalculate');
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  return { score, loading, error, refresh: fetch, recalculate };
}

export function useAllScores() {
  const [scores, setScores] = useState<LeadScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await leadService.getAllScores();
      setScores(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load scores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await leadService.getAllScores();
        if (!cancelled) setScores(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load scores');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const batchUpdate = useCallback(async () => {
    setLoading(true);
    try {
      const count = await leadService.batchUpdateScores();
      await fetchAll();
      return count;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Batch update failed');
      return 0;
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  const scoresMap = new Map(scores.map((s) => [s.leadId, s]));

  return { scores, scoresMap, loading, error, refresh: fetchAll, batchUpdate };
}
