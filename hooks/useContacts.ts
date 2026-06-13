'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Contact, ContactFormData } from '@/types/contact.types';
import { contactService } from '@/services/contact.service';

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contactService.getAll();
      setContacts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getById = useCallback(async (id: string) => {
    try {
      return await contactService.getById(id);
    } catch {
      return undefined;
    }
  }, []);

  const getByCompanyId = useCallback(async (companyId: string) => {
    try {
      return await contactService.getByCompanyId(companyId);
    } catch {
      return [];
    }
  }, []);

  const createContact = useCallback(async (data: ContactFormData) => {
    try {
      const newContact = await contactService.create(data);
      setContacts((prev) => [newContact, ...prev]);
      return newContact;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create contact');
      return undefined;
    }
  }, []);

  const updateContact = useCallback(async (id: string, data: Partial<ContactFormData>) => {
    try {
      const updated = await contactService.update(id, data);
      if (updated) setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update contact');
      return undefined;
    }
  }, []);

  const deleteContact = useCallback(async (id: string) => {
    try {
      const success = await contactService.delete(id);
      if (success) setContacts((prev) => prev.filter((c) => c.id !== id));
      return success;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete contact');
      return false;
    }
  }, []);

  return { contacts, loading, error, refresh, getById, getByCompanyId, createContact, updateContact, deleteContact };
}
