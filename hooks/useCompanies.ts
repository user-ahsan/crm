'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Company, CompanyFormData } from '@/types/company.types';
import { generateId } from '@/lib/formatters';
import { companyService } from '@/services/company.service';
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

  const getById = useCallback(async (id: string) => {
    try {
      return await companyService.getById(id);
    } catch {
      // Error preserved in error state
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
    let prevItem: Company | undefined;
    setCompanies((prev) => {
      prevItem = prev.find((c) => c.id === id);
      return prev.map((c) => (c.id === id ? { ...c, ...data } : c));
    });
    try {
      const updated = await companyService.update(id, data);
      if (updated) {
        setCompanies((prev) => prev.map((c) => (c.id === id ? updated : c)));
        useEntityCache.getState().updateCompany(id, updated);
      }
      return updated;
    } catch (e) {
      if (prevItem) setCompanies((prev) => prev.map((c) => (c.id === id ? prevItem! : c)));
      setError(e instanceof Error ? e.message : 'Failed to update company');
      return undefined;
    }
  }, []);

  const deleteCompany = useCallback(async (id: string) => {
    let prevItem: Company | undefined;
    setCompanies((prev) => {
      prevItem = prev.find((c) => c.id === id);
      return prev.filter((c) => c.id !== id);
    });
    try {
      await companyService.delete(id);
      useEntityCache.getState().removeCompany(id);
      return true;
    } catch (e) {
      if (prevItem) setCompanies((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete company');
      return false;
    }
  }, []);

  return { companies, loading, error, refresh, getById, createCompany, updateCompany, deleteCompany };
}
