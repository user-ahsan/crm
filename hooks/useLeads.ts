'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Lead, LeadFormData, LeadFilters } from '@/types/lead.types';
import { generateId } from '@/lib/formatters';
import { leadService } from '@/services/lead.service';
import { applyLeadFilters } from '@/modules/leads/leadFilters';
import { useEntityCache, isCacheStale } from '@/store/entity-cache';

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
      const store = useEntityCache.getState();
      store.setLeads(data);
      store.setLastFetched('leads');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // P8: Skip fetch if cache is fresh
    const store = useEntityCache.getState();
    if (!isCacheStale(store, 'leads') && store.leads.length > 0) {
      setLeads(store.leads);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const getFiltered = useCallback((filters: LeadFilters) => {
    return applyLeadFilters(leads, filters);
  }, [leads]);

  const getById = useCallback(async (id: string) => {
    try {
      return await leadService.getById(id);
    } catch (err) {
      // Error preserved in error state
      return undefined;
    }
  }, []);

  const createLead = useCallback(async (data: LeadFormData) => {
    const tempId = generateId();
    const optimisticItem: Lead = {
      id: tempId,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      companyName: data.companyName,
      industry: data.industry,
      country: data.country,
      source: data.source,
      status: data.status,
      priority: data.priority,
      assignedTo: data.assignedTo,
      estimatedValue: data.estimatedValue,
      tags: data.tags ?? [],
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
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
    let prevItem: Lead | undefined;
    setLeads((prev) => {
      prevItem = prev.find((l) => l.id === id);
      return prev.map((l) => (l.id === id ? { ...l, ...data } : l));
    });
    try {
      const updated = await leadService.update(id, data);
      if (updated) {
        setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
        useEntityCache.getState().updateLead(id, updated);
      }
      return updated;
    } catch (e) {
      if (prevItem) setLeads((prev) => prev.map((l) => (l.id === id ? prevItem! : l)));
      setError(e instanceof Error ? e.message : 'Failed to update lead');
      return undefined;
    }
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    let prevItem: Lead | undefined;
    setLeads((prev) => {
      prevItem = prev.find((l) => l.id === id);
      return prev.filter((l) => l.id !== id);
    });
    try {
      await leadService.delete(id);
      useEntityCache.getState().removeLead(id);
      return true;
    } catch (e) {
      if (prevItem) setLeads((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete lead');
      return false;
    }
  }, []);

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
