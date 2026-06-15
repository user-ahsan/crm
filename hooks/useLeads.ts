'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Lead, LeadFormData, LeadFilters } from '@/types/lead.types';
import { leadService } from '@/services/lead.service';
import { applyLeadFilters } from '@/modules/leads/leadFilters';
import { useEntityCache } from '@/store/entity-cache';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await leadService.getAll();
      setLeads(data);
      useEntityCache.getState().setLeads(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    leadService.getAll()
      .then((data) => {
        if (cancelled) return;
        setLeads(data);
        useEntityCache.getState().setLeads(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load leads');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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
    const tempId = `temp-${Date.now()}`;
    const optimisticItem = { ...data, id: tempId, createdAt: new Date().toISOString() } as Lead;
    setLeads((prev) => [optimisticItem, ...prev]);
    try {
      const created = await leadService.create(data);
      setLeads((prev) => prev.map((l) => (l.id === tempId ? created : l)));
      const { leads: cachedLeads, setLeads: setCache } = useEntityCache.getState();
      setCache([created, ...cachedLeads]);
      return created;
    } catch (e) {
      setLeads((prev) => prev.filter((l) => l.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create lead');
      return undefined;
    }
  }, []);

  const updateLead = useCallback(async (id: string, data: Partial<LeadFormData>) => {
    const previous = leads;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...data } : l)));
    try {
      const updated = await leadService.update(id, data);
      if (updated) {
        setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
        useEntityCache.getState().updateLead(id, updated);
      }
      return updated;
    } catch (e) {
      setLeads(previous);
      setError(e instanceof Error ? e.message : 'Failed to update lead');
      return undefined;
    }
  }, [leads]);

  const deleteLead = useCallback(async (id: string) => {
    const previous = leads;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    try {
      await leadService.delete(id);
      useEntityCache.getState().removeLead(id);
      return true;
    } catch (e) {
      setLeads(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete lead');
      return false;
    }
  }, [leads]);

  return {
    leads,
    loading,
    error,
    refresh,
    getFiltered,
    getById,
    createLead,
    updateLead,
    deleteLead,
  };
}
