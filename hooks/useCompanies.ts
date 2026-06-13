'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Company, CompanyFormData } from '@/types/company.types';
import { companyService } from '@/services/company.service';
import { useEntityCache } from '@/store/entity-cache';

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
      useEntityCache.getState().setCompanies(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await companyService.getAll();
        if (!cancelled) {
          setCompanies(data);
          useEntityCache.getState().setCompanies(data);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load companies');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const getById = useCallback(async (id: string) => {
    try {
      return await companyService.getById(id);
    } catch {
      return undefined;
    }
  }, []);

  const createCompany = useCallback(async (data: CompanyFormData) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticItem = { ...data, id: tempId, createdAt: new Date().toISOString() } as Company;
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
    const previous = companies;
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    try {
      const updated = await companyService.update(id, data);
      if (updated) {
        setCompanies((prev) => prev.map((c) => (c.id === id ? updated : c)));
        useEntityCache.getState().updateCompany(id, updated);
      }
      return updated;
    } catch (e) {
      setCompanies(previous);
      setError(e instanceof Error ? e.message : 'Failed to update company');
      return undefined;
    }
  }, [companies]);

  const deleteCompany = useCallback(async (id: string) => {
    const previous = companies;
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    try {
      await companyService.delete(id);
      useEntityCache.getState().removeCompany(id);
      return true;
    } catch (e) {
      setCompanies(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete company');
      return false;
    }
  }, [companies]);

  return { companies, loading, error, refresh, getById, createCompany, updateCompany, deleteCompany };
}
