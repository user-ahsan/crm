'use client';

import { useState, useCallback, useEffect } from 'react';
import type { EmailSequence, CampaignEmail, EmailSequenceFormData, CampaignEmailFormData, CampaignStatus } from '@/types/campaign.types';
import { campaignService } from '@/services/campaign.service';

export function useCampaigns() {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const tempId = `temp-${Date.now()}`;
    const optimistic: EmailSequence = {
      ...data,
      id: tempId,
      description: data.description ?? '',
      status: data.status ?? 'draft',
      createdBy: '',
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
  }, []);

  const updateSequence = useCallback(async (id: string, data: Partial<EmailSequenceFormData>) => {
    const previous = sequences;
    setSequences((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    try {
      const updated = await campaignService.updateSequence(id, data);
      if (updated) {
        setSequences((prev) => prev.map((s) => (s.id === id ? updated : s)));
      }
      return updated;
    } catch (e) {
      setSequences(previous);
      setError(e instanceof Error ? e.message : 'Failed to update sequence');
      return undefined;
    }
  }, [sequences]);

  const deleteSequence = useCallback(async (id: string) => {
    const previous = sequences;
    setSequences((prev) => prev.filter((s) => s.id !== id));
    try {
      await campaignService.deleteSequence(id);
      return true;
    } catch (e) {
      setSequences(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete sequence');
      return false;
    }
  }, [sequences]);

  const updateSequenceStatus = useCallback(async (id: string, status: CampaignStatus) => {
    return updateSequence(id, { status });
  }, [updateSequence]);

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
    const tempId = `temp-${Date.now()}`;
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
    const previous = emails;
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
    try {
      const updated = await campaignService.updateCampaignEmail(id, data);
      if (updated) {
        setEmails((prev) => prev.map((e) => (e.id === id ? updated : e)));
      }
      return updated;
    } catch (e) {
      setEmails(previous);
      setError(e instanceof Error ? e.message : 'Failed to update email');
      return undefined;
    }
  }, [emails]);

  const deleteEmail = useCallback(async (id: string) => {
    const previous = emails;
    setEmails((prev) => prev.filter((e) => e.id !== id));
    try {
      await campaignService.deleteCampaignEmail(id);
      return true;
    } catch (e) {
      setEmails(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete email');
      return false;
    }
  }, [emails]);

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
