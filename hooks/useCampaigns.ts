'use client';

import { useState, useCallback, useEffect } from 'react';
import type { EmailSequence, CampaignEmail, EmailSequenceFormData, CampaignEmailFormData, CampaignStatus } from '@/types/campaign.types';
import { generateId } from '@/lib/formatters';
import { campaignService } from '@/services/campaign.service';
import { campaignScheduler } from '@/services/campaign-scheduler.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export interface SequenceStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

export interface EnrichedStats {
  emailCount: number;
  recipientCount: number;
}

export function useCampaigns() {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, SequenceStats>>({});
  const { user } = useCurrentUser();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await campaignService.getSequences();
      setSequences(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await campaignService.getSequences();
        if (!cancelled) setSequences(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load campaigns');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getSequence = useCallback(async (id: string) => {
    try {
      return await campaignService.getSequence(id);
    } catch {
      return undefined;
    }
  }, []);

  const createSequence = useCallback(async (data: EmailSequenceFormData) => {
    const tempId = generateId();
    const optimistic: EmailSequence = {
      ...data,
      id: tempId,
      description: data.description ?? '',
      status: data.status ?? 'draft',
      createdBy: user?.id ?? '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSequences((prev) => [optimistic, ...prev]);
    try {
      const created = await campaignService.createSequence(data);
      setSequences((prev) => prev.map((s) => (s.id === tempId ? created : s)));
      return created;
    } catch (e) {
      setSequences((prev) => prev.filter((s) => s.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create sequence');
      return undefined;
    }
  }, [user?.id]);

  const updateSequence = useCallback(async (id: string, data: Partial<EmailSequenceFormData>) => {
    let previous: EmailSequence[] | undefined;
    setSequences((prev) => { previous = [...prev]; return prev.map((s) => (s.id === id ? { ...s, ...data } : s)); });
    try {
      const updated = await campaignService.updateSequence(id, data);
      if (updated) {
        setSequences((prev) => prev.map((s) => (s.id === id ? updated : s)));
      }
      return updated;
    } catch (e) {
      if (previous) setSequences(previous);
      setError(e instanceof Error ? e.message : 'Failed to update sequence');
      return undefined;
    }
  }, []);

  const deleteSequence = useCallback(async (id: string) => {
    let previous: EmailSequence[] | undefined;
    setSequences((prev) => { previous = [...prev]; return prev.filter((s) => s.id !== id); });
    try {
      await campaignService.deleteSequence(id);
      return true;
    } catch (e) {
      if (previous) setSequences(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete sequence');
      return false;
    }
  }, []);

  /**
   * Applies a lifecycle status transition with optimistic UI + rollback.
   * 'active' is deliberately rejected here — activation only happens through
   * campaignScheduler.activateSequence (queues recipients) or
   * campaignScheduler.resumeSequence (F17 transition enforcement).
   */
  const updateSequenceStatus = useCallback(async (id: string, status: CampaignStatus) => {
    let previous: EmailSequence | undefined;
    setSequences((prev) => {
      previous = prev.find((s) => s.id === id);
      return prev.map((s) => (s.id === id ? { ...s, status } : s));
    });
    try {
      if (status === 'active') {
        throw new Error('Sequences become active through activation, which queues recipients. Use activateSequence instead.');
      }
      const updated = await campaignService.updateSequenceStatus(id, status);
      if (updated) {
        setSequences((prev) => prev.map((s) => (s.id === id ? updated : s)));
      }
      return updated;
    } catch (e) {
      if (previous) {
        setSequences((prev) => prev.map((s) => (s.id === id && previous ? { ...s, status: previous.status } : s)));
      }
      setError(e instanceof Error ? e.message : 'Failed to update sequence status');
      return undefined;
    }
  }, []);

  /**
   * Activates a draft sequence through the REAL scheduler path — validates
   * draft-only, inserts recipient rows (batched), and only then flips the
   * sequence to active. `campaignService.updateSequenceStatus('active')`
   * throws INVALID_TRANSITION by design (F17), so this is the only hook path
   * to activation. Optimistic status change with rollback + error surfacing.
   */
  const activateSequence = useCallback(async (
    sequenceId: string,
    leadIds?: string[],
    contactIds?: string[],
  ): Promise<{ total: number }> => {
    let previous: EmailSequence | undefined;
    setSequences((prev) => {
      previous = prev.find((s) => s.id === sequenceId);
      return prev.map((s) => (s.id === sequenceId ? { ...s, status: 'active' } : s));
    });
    try {
      const result = await campaignScheduler.activateSequence(sequenceId, leadIds, contactIds);
      // The scheduler returns only { total }; re-sync the sequence row from
      // the service so local state carries the server-confirmed row.
      const updated = await campaignService.getSequence(sequenceId);
      if (updated) {
        setSequences((prev) => prev.map((s) => (s.id === sequenceId ? updated : s)));
      }
      return result;
    } catch (e) {
      if (previous) {
        setSequences((prev) => prev.map((s) => (s.id === sequenceId && previous ? { ...s, status: previous.status } : s)));
      }
      setError(e instanceof Error ? e.message : 'Failed to activate sequence');
      return { total: 0 };
    }
  }, []);

  /**
   * Pauses an active sequence through the scheduler's lifecycle path
   * (active → paused). Optimistic status change with rollback; rethrows so
   * callers can toast the failure (the hook also sets error state).
   */
  const pauseSequence = useCallback(async (sequenceId: string): Promise<void> => {
    let previous: EmailSequence | undefined;
    setSequences((prev) => {
      previous = prev.find((s) => s.id === sequenceId);
      return prev.map((s) => (s.id === sequenceId ? { ...s, status: 'paused' } : s));
    });
    try {
      await campaignScheduler.pauseSequence(sequenceId);
      const updated = await campaignService.getSequence(sequenceId);
      if (updated) {
        setSequences((prev) => prev.map((s) => (s.id === sequenceId ? updated : s)));
      }
    } catch (e) {
      if (previous) {
        setSequences((prev) => prev.map((s) => (s.id === sequenceId && previous ? { ...s, status: previous.status } : s)));
      }
      setError(e instanceof Error ? e.message : 'Failed to pause sequence');
      throw e instanceof Error ? e : new Error('Failed to pause sequence');
    }
  }, []);

  /**
   * Delivery statistics read from the REAL campaign_recipients rows via the
   * scheduler service (F17) — no fabricated numbers. Cached per sequence id.
   * Throws on failure (honest: returning zeros would fabricate stats).
   */
  const getSequenceStats = useCallback(async (sequenceId: string): Promise<SequenceStats> => {
    const cached = statsMap[sequenceId];
    if (cached) return cached;
    try {
      const stats = await campaignScheduler.getSequenceStats(sequenceId);
      const projected: SequenceStats = {
        total: stats.total,
        sent: stats.sent,
        failed: stats.failed,
        pending: stats.pending,
      };
      setStatsMap((prev) => ({ ...prev, [sequenceId]: projected }));
      return projected;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sequence stats');
      throw e instanceof Error ? e : new Error('Failed to load sequence stats');
    }
  }, [statsMap]);

  /**
   * Adds leads/contacts as recipients via the real recipients API route
   * (same POST the detail page uses) — recipient rows are persisted with
   * dedupe on (sequence_id, recipient_type, recipient_id).
   */
  const addRecipients = useCallback(async (
    sequenceId: string,
    leadIds?: string[],
    contactIds?: string[],
  ): Promise<{ added: number }> => {
    try {
      const res = await fetch('/api/campaigns/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequenceId,
          leadIds: leadIds && leadIds.length > 0 ? leadIds : undefined,
          contactIds: contactIds && contactIds.length > 0 ? contactIds : undefined,
        }),
      });
      const data = await res.json().catch(() => ({})) as { added?: number; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to add recipients');
      }
      return { added: typeof data.added === 'number' ? data.added : 0 };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add recipients');
      throw e instanceof Error ? e : new Error('Failed to add recipients');
    }
  }, []);

  return {
    sequences,
    loading,
    error,
    refresh,
    getSequence,
    createSequence,
    updateSequence,
    deleteSequence,
    updateSequenceStatus,
    activateSequence,
    pauseSequence,
    getSequenceStats,
    statsMap,
    addRecipients,
  };
}

export function useCampaignEmails(sequenceId: string) {
  const [emails, setEmails] = useState<CampaignEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await campaignService.getCampaignEmails(sequenceId);
      setEmails(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaign emails');
    } finally {
      setLoading(false);
    }
  }, [sequenceId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await campaignService.getCampaignEmails(sequenceId);
        if (!cancelled) setEmails(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load campaign emails');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sequenceId]);

  const addEmail = useCallback(async (data: CampaignEmailFormData) => {
    const tempId = generateId();
    const optimistic: CampaignEmail = {
      ...data,
      id: tempId,
      body: data.body ?? '',
      delayDays: data.delayDays ?? 0,
      sortOrder: data.sortOrder ?? 0,
      createdAt: new Date().toISOString(),
    };
    setEmails((prev) => [...prev, optimistic]);
    try {
      const created = await campaignService.addCampaignEmail(data);
      setEmails((prev) => prev.map((e) => (e.id === tempId ? created : e)));
      return created;
    } catch (e) {
      setEmails((prev) => prev.filter((e) => e.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to add email');
      return undefined;
    }
  }, []);

  const updateEmail = useCallback(async (id: string, data: Partial<CampaignEmailFormData>) => {
    let previous: CampaignEmail[] | undefined;
    setEmails((prev) => { previous = [...prev]; return prev.map((e) => (e.id === id ? { ...e, ...data } : e)); });
    try {
      const updated = await campaignService.updateCampaignEmail(id, data);
      if (updated) {
        setEmails((prev) => prev.map((e) => (e.id === id ? updated : e)));
      }
      return updated;
    } catch (e) {
      if (previous) setEmails(previous);
      setError(e instanceof Error ? e.message : 'Failed to update email');
      return undefined;
    }
  }, []);

  const deleteEmail = useCallback(async (id: string) => {
    let previous: CampaignEmail[] | undefined;
    setEmails((prev) => { previous = [...prev]; return prev.filter((e) => e.id !== id); });
    try {
      await campaignService.deleteCampaignEmail(id);
      return true;
    } catch (e) {
      if (previous) setEmails(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete email');
      return false;
    }
  }, []);

  /**
   * Rewrites sort_order for every email in the sequence to match the order of
   * `orderedEmailIds`. Permutation of every existing id is required (service
   * rejects partial/duplicate payloads). Optimistic reorder with rollback on
   * failure; service returns the re-sorted list from the DB on success.
   */
  const reorderEmails = useCallback(async (orderedEmailIds: string[]) => {
    let previous: CampaignEmail[] | undefined;
    setEmails((prev) => {
      previous = [...prev];
      const byId = new Map(prev.map((e) => [e.id, e]));
      return orderedEmailIds
        .map((id, idx) => {
          const email = byId.get(id);
          return email ? { ...email, sortOrder: idx } : null;
        })
        .filter((e): e is CampaignEmail => e !== null);
    });
    try {
      const reordered = await campaignService.reorderEmails(sequenceId, orderedEmailIds);
      setEmails(reordered);
      return reordered;
    } catch (e) {
      if (previous) setEmails(previous);
      setError(e instanceof Error ? e.message : 'Failed to reorder emails');
      return undefined;
    }
  }, [sequenceId]);

  return {
    emails,
    loading,
    error,
    refresh,
    addEmail,
    updateEmail,
    deleteEmail,
    reorderEmails,
  };
}
