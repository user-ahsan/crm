'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEntityCache } from '@/store/entity-cache';
import { companyService } from '@/services/company.service';
import type { CompanyFormData } from '@/types/company.types';

export function useCachedCompanies() {
  const companies = useEntityCache((s) => s.companies);
  const setCompanies = useEntityCache((s) => s.setCompanies);
  const updateCompany = useEntityCache((s) => s.updateCompany);
  const removeCompany = useEntityCache((s) => s.removeCompany);
  const [loading, setLoading] = useState(companies.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refreshFromServer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await companyService.getAll();
      setCompanies(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [setCompanies]);

  useEffect(() => {
    if (companies.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await companyService.getAll();
        if (!cancelled) setCompanies(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load companies');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companies.length, setCompanies]);

  const getById = useCallback(async (id: string) => {
    try {
      return await companyService.getById(id);
    } catch {
      return undefined;
    }
  }, []);

  const createCompany = useCallback(async (data: CompanyFormData) => {
    try {
      const created = await companyService.create(data);
      const { companies: cached, setCompanies: setCache } = useEntityCache.getState();
      setCache([created, ...cached]);
      return created;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create company');
      return undefined;
    }
  }, []);

  const updateCachedCompany = useCallback(async (id: string, data: Partial<CompanyFormData>) => {
    try {
      const updated = await companyService.update(id, data);
      if (updated) updateCompany(id, updated);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update company');
      return undefined;
    }
  }, [updateCompany]);

  const deleteCachedCompany = useCallback(async (id: string) => {
    try {
      await companyService.delete(id);
      removeCompany(id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete company');
      return false;
    }
  }, [removeCompany]);

  return {
    companies,
    loading,
    error,
    refreshFromServer,
    getById,
    createCompany,
    updateCompany: updateCachedCompany,
    deleteCompany: deleteCachedCompany,
  };
}
