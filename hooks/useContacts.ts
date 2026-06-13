'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Contact, ContactFormData } from '@/types/contact.types';
import { contactService } from '@/services/contact.service';

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      setContacts(contactService.getAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getById = useCallback((id: string) => contactService.getById(id), []);
  const getByCompanyId = useCallback((companyId: string) => contactService.getByCompanyId(companyId), []);

  const createContact = useCallback((data: ContactFormData) => {
    try {
      const newContact = contactService.create(data);
      setContacts((prev) => [newContact, ...prev]);
      return newContact;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create contact');
      return undefined;
    }
  }, []);

  const updateContact = useCallback((id: string, data: Partial<ContactFormData>) => {
    try {
      const updated = contactService.update(id, data);
      if (updated) setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update contact');
      return undefined;
    }
  }, []);

  const deleteContact = useCallback((id: string) => {
    try {
      const success = contactService.delete(id);
      if (success) setContacts((prev) => prev.filter((c) => c.id !== id));
      return success;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete contact');
      return false;
    }
  }, []);

  return { contacts, loading, error, refresh, getById, getByCompanyId, createContact, updateContact, deleteContact };
}
