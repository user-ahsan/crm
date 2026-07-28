'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────

export interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

export interface UseCampaignStatsResult {
  stats: CampaignStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ── Constants ─────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000; // 30 seconds

// ── Hook: useCampaignStats ────────────────────────────────────────────

/**
 * Polls /api/campaigns/[sequenceId]/stats every 30 seconds while the
 * sequence status is 'active'. Stops polling when the sequence reaches
 * 'completed' status.
 *
 * @param sequenceId - The email_sequence UUID to track.
 * @returns { stats, loading, error, refresh }
 */
export function useCampaignStats(sequenceId: string): UseCampaignStatsResult {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(sequenceId)}/stats`);
      if (!res.ok) {
        if (res.status === 404) {
          // Sequence may have been deleted
          setError('Campaign not found');
          return;
        }
        throw new Error(`Failed to fetch stats (${res.status})`);
      }
      const data: CampaignStats = await res.json();
      setStats(data);
      setError(null);

      // Stop polling if sequence is completed (all recipients processed)
      if (data.pending === 0 && data.total > 0 && data.sent + data.failed === data.total) {
        activeRef.current = false;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaign stats');
    } finally {
      setLoading(false);
    }
  }, [sequenceId]);

  // Initial fetch + poll setup
  useEffect(() => {
    let cancelled = false;

    const doFetch = async () => {
      try {
        const res = await fetch(`/api/campaigns/${encodeURIComponent(sequenceId)}/stats`);
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setError('Campaign not found');
            return;
          }
          throw new Error(`Failed to fetch stats (${res.status})`);
        }
        const data: CampaignStats = await res.json();
        if (cancelled) return;
        setStats(data);
        setError(null);

        // If sequence is complete, mark inactive so polling stops
        if (data.pending === 0 && data.total > 0 && data.sent + data.failed === data.total) {
          activeRef.current = false;
        } else {
          activeRef.current = true;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load campaign stats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    doFetch();

    // Set up polling interval — polls only while activeRef.current is true
    intervalRef.current = setInterval(async () => {
      if (cancelled || !activeRef.current) return;

      try {
        const res = await fetch(`/api/campaigns/${encodeURIComponent(sequenceId)}/stats`);
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setError('Campaign not found');
            activeRef.current = false;
            return;
          }
          return; // Silent retry on next interval
        }
        const data: CampaignStats = await res.json();
        if (cancelled) return;
        setStats(data);

        // Stop polling when all recipients are processed
        if (data.pending === 0 && data.total > 0 && data.sent + data.failed === data.total) {
          activeRef.current = false;
        }
      } catch {
        // Silent poll — errors are expected if network is flaky
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      activeRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sequenceId]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}
