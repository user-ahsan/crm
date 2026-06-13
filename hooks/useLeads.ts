'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Lead, LeadFormData, LeadFilters } from '@/types/lead.types';
import { leadService } from '@/services/lead.service';
import { applyLeadFilters, sortLeads } from '@/modules/leads/leadFilters';

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
      setLeads((prev) => [newLead, ...prev]);
      return newLead;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create lead');
      return undefined;
    }
  }, []);

  const updateLead = useCallback(async (id: string, data: Partial<LeadFormData>) => {
    try {
      const updated = await leadService.update(id, data);
      if (updated) {
        setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      }
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update lead');
      return undefined;
    }
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    try {
      const success = await leadService.delete(id);
      if (success) setLeads((prev) => prev.filter((l) => l.id !== id));
      return success;
    } catch (e) {
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
