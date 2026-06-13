'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Company, CompanyFormData } from '@/types/company.types';
import { companyService } from '@/services/company.service';
import { contactService } from '@/services/contact.service';

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getById = useCallback(async (id: string) => {
    try {
      return await companyService.getById(id);
    } catch {
      return undefined;
    }
  }, []);

  const createCompany = useCallback(async (data: CompanyFormData) => {
    try {
      const newCompany = await companyService.create(data);
      setCompanies((prev) => [newCompany, ...prev]);
      return newCompany;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create company');
      return undefined;
    }
  }, []);

  const updateCompany = useCallback(async (id: string, data: Partial<CompanyFormData>) => {
    try {
      const updated = await companyService.update(id, data);
      if (updated) setCompanies((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update company');
      return undefined;
    }
  }, []);

  const deleteCompany = useCallback(async (id: string) => {
    try {
      const success = await companyService.delete(id);
      if (success) setCompanies((prev) => prev.filter((c) => c.id !== id));
      return success;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete company');
      return false;
    }
  }, []);

  const getContactsForCompany = useCallback(async (companyId: string) => {
    try {
      return await contactService.getByCompanyId(companyId);
    } catch {
      return [];
    }
  }, []);

  return { companies, loading, error, refresh, getById, createCompany, updateCompany, deleteCompany, getContactsForCompany };
}
