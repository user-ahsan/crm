'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Company, CompanyFormData } from '@/types/company.types';
import { companyService } from '@/services/company.service';
import { contactService } from '@/services/contact.service';

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      setCompanies(companyService.getAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getById = useCallback((id: string) => companyService.getById(id), []);

  const createCompany = useCallback((data: CompanyFormData) => {
    try {
      const newCompany = companyService.create(data);
      setCompanies((prev) => [newCompany, ...prev]);
      return newCompany;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create company');
      return undefined;
    }
  }, []);

  const updateCompany = useCallback((id: string, data: Partial<CompanyFormData>) => {
    try {
      const updated = companyService.update(id, data);
      if (updated) setCompanies((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update company');
      return undefined;
    }
  }, []);

  const deleteCompany = useCallback((id: string) => {
    try {
      const success = companyService.delete(id);
      if (success) setCompanies((prev) => prev.filter((c) => c.id !== id));
      return success;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete company');
      return false;
    }
  }, []);

  const getContactsForCompany = useCallback((companyId: string) => {
    return contactService.getByCompanyId(companyId);
  }, []);

  return { companies, loading, error, refresh, getById, createCompany, updateCompany, deleteCompany, getContactsForCompany };
}
