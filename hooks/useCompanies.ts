'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Company, CompanyFormData, CompanyFilters } from '@/types/company.types';
import { generateId } from '@/lib/formatters';
import { companyService } from '@/services/company.service';
import { searchCompanies } from '@/modules/companies/companyFilters';
import { useEntityCache, isCacheStale } from '@/store/entity-cache';

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await companyService.getAll();
      setCompanies(data);
      const store = useEntityCache.getState();
      store.setCompanies(data);
      store.setLastFetched('companies');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // P8: Skip fetch if cache is fresh
    const store = useEntityCache.getState();
    if (!isCacheStale(store, 'companies') && store.companies.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompanies(store.companies);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  // Documented filter API (HOOKS.md:82) — mirrors useLeads.getFiltered:
  // a synchronous filter over the loaded state with AND semantics.
  const getFiltered = useCallback((filters: CompanyFilters) => {
    let result = filters.search ? searchCompanies(companies, filters.search) : companies;
    const industry = filters.industry?.trim();
    if (industry) result = result.filter((c) => c.industry === industry);
    if (filters.size && filters.size !== '') result = result.filter((c) => c.size === filters.size);
    return result;
  }, [companies]);

  const getById = useCallback(async (id: string) => {
    try {
      return await companyService.getById(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load company');
      return undefined;
    }
  }, []);

  const createCompany = useCallback(async (data: CompanyFormData) => {
    const tempId = generateId();
    const optimisticItem: Company = {
      id: tempId,
      name: data.name,
      industry: data.industry,
      size: data.size,
      revenue: data.revenue,
      location: data.location,
      website: data.website,
      contactIds: [],
      leadIds: [],
      tags: data.tags ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCompanies((prev) => [optimisticItem, ...prev]);
    try {
      const created = await companyService.create(data);
      setCompanies((prev) => prev.map((c) => (c.id === tempId ? created : c)));
      const { companies: cached, setCompanies: setCache } = useEntityCache.getState();
      setCache([created, ...cached]);
      return created;
    } catch (e) {
      setCompanies((prev) => prev.filter((c) => c.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create company');
      return undefined;
    }
  }, []);

  const updateCompany = useCallback(async (id: string, data: Partial<CompanyFormData>) => {
    // Capture the pre-mutation row OUTSIDE the state updater so rollback can
    // restore the exact object at its original index (ARCHITECTURE §10).
    const prevItem = companies.find((c) => c.id === id);
    if (!prevItem) return undefined;
    const prevIndex = companies.indexOf(prevItem);
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    try {
      const updated = await companyService.update(id, data);
      if (!updated) {
        // PGRST116 not-found: revert the optimistic change and surface it.
        setCompanies((prev) => {
          const next = prev.filter((c) => c.id !== id);
          next.splice(Math.min(prevIndex, next.length), 0, prevItem);
          return next;
        });
        setError('Failed to update company: record not found');
        return undefined;
      }
      setCompanies((prev) => prev.map((c) => (c.id === id ? updated : c)));
      useEntityCache.getState().updateCompany(id, updated);
      return updated;
    } catch (e) {
      setCompanies((prev) => {
        const next = prev.filter((c) => c.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to update company');
      return undefined;
    }
  }, [companies]);

  const deleteCompany = useCallback(async (id: string) => {
    const prevItem = companies.find((c) => c.id === id);
    if (!prevItem) return false;
    const prevIndex = companies.indexOf(prevItem);
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    try {
      await companyService.delete(id);
      useEntityCache.getState().removeCompany(id);
      return true;
    } catch (e) {
      setCompanies((prev) => {
        const next = prev.filter((c) => c.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to delete company');
      return false;
    }
  }, [companies]);

  return { companies, loading, error, refresh, getFiltered, getById, createCompany, updateCompany, deleteCompany };
}
