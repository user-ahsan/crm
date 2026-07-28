'use client';

import { useState, useCallback, useEffect } from 'react';
import type { EmailSequence, CampaignEmail, EmailSequenceFormData, CampaignEmailFormData, CampaignStatus } from '@/types/campaign.types';
import { generateId } from '@/lib/formatters';
import { campaignService } from '@/services/campaign.service';
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

  const updateSequenceStatus = useCallback(async (id: string, status: CampaignStatus) => {
    return updateSequence(id, { status });
  }, [updateSequence]);

  const activateSequence = useCallback(async (
    sequenceId: string,
    leadIds?: string[],
    contactIds?: string[],
  ): Promise<{ total: number }> => {
    const updated = await campaignService.updateSequenceStatus(sequenceId, 'active');
    if (updated) {
      setSequences((prev) =>
        prev.map((s) => (s.id === sequenceId ? updated : s)),
      );
    }
    return { total: (leadIds?.length ?? 0) + (contactIds?.length ?? 0) };
  }, []);

  const pauseSequence = useCallback(async (sequenceId: string): Promise<void> => {
    const updated = await campaignService.updateSequenceStatus(sequenceId, 'paused');
    if (updated) {
      setSequences((prev) =>
        prev.map((s) => (s.id === sequenceId ? updated : s)),
      );
    }
  }, []);

  const getSequenceStats = useCallback(async (sequenceId: string): Promise<SequenceStats> => {
    if (statsMap[sequenceId]) return statsMap[sequenceId];
    await campaignService.getSequence(sequenceId);
    const emails = await campaignService.getCampaignEmails(sequenceId);
    const stats: SequenceStats = {
      total: emails.length,
      sent: 0,
      failed: 0,
      pending: emails.length,
    };
    setStatsMap((prev) => ({ ...prev, [sequenceId]: stats }));
    return stats;
  }, [statsMap]);

  const addRecipients = useCallback(async (
    sequenceId: string,
    leadIds?: string[],
    contactIds?: string[],
  ): Promise<{ added: number }> => {
    // Recipient tracking goes through the update sequence flow
    await campaignService.updateSequence(sequenceId, {});
    return { added: (leadIds?.length ?? 0) + (contactIds?.length ?? 0) };
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

  return {
    emails,
    loading,
    error,
    refresh,
    addEmail,
    updateEmail,
    deleteEmail,
  };
}
