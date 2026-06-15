'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEntityCache } from '@/store/entity-cache';
import { leadService } from '@/services/lead.service';
import type { LeadFormData, LeadFilters } from '@/types/lead.types';
import { applyLeadFilters } from '@/modules/leads/leadFilters';

export function useCachedLeads() {
  const leads = useEntityCache((s) => s.leads);
  const setLeads = useEntityCache((s) => s.setLeads);
  const updateLead = useEntityCache((s) => s.updateLead);
  const removeLead = useEntityCache((s) => s.removeLead);
  const [loading, setLoading] = useState(leads.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refreshFromServer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await leadService.getAll();
      setLeads(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [setLeads]);

  useEffect(() => {
    if (leads.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await leadService.getAll();
        if (!cancelled) setLeads(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load leads');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leads.length, setLeads]);

  const getFiltered = useCallback((filters: LeadFilters) => {
    return applyLeadFilters(leads, filters);
  }, [leads]);

  const getById = useCallback(async (id: string) => {
    try {
      return await leadService.getById(id);
    } catch {
      return undefined;
    }
  }, []);

  const createLead = useCallback(async (data: LeadFormData) => {
    try {
      const newLead = await leadService.create(data);
      const { leads: cached, setLeads: setCache } = useEntityCache.getState();
      setCache([newLead, ...cached]);
      return newLead;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create lead');
      return undefined;
    }
  }, []);

  const updateCachedLead = useCallback(async (id: string, data: Partial<LeadFormData>) => {
    try {
      const updated = await leadService.update(id, data);
      if (updated) updateLead(id, updated);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update lead');
      return undefined;
    }
  }, [updateLead]);

  const deleteCachedLead = useCallback(async (id: string) => {
    try {
      const success = await leadService.delete(id);
      if (success) removeLead(id);
      return success;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete lead');
      return false;
    }
  }, [removeLead]);

  return {
    leads,
    loading,
    error,
    refreshFromServer,
    getFiltered,
    getById,
    createLead,
    updateLead: updateCachedLead,
    deleteLead: deleteCachedLead,
  };
}
