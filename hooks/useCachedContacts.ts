'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEntityCache } from '@/store/entity-cache';
import { contactService } from '@/services/contact.service';
import type { ContactFormData } from '@/types/contact.types';

export function useCachedContacts() {
  const contacts = useEntityCache((s) => s.contacts);
  const setContacts = useEntityCache((s) => s.setContacts);
  const updateContact = useEntityCache((s) => s.updateContact);
  const removeContact = useEntityCache((s) => s.removeContact);
  const [loading, setLoading] = useState(contacts.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refreshFromServer = useCallback(async () => {
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
  }, [setContacts]);

  useEffect(() => {
    if (contacts.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await contactService.getAll();
        if (!cancelled) setContacts(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load contacts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contacts.length, setContacts]);

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
      const created = await contactService.create(data);
      const { contacts: cached, setContacts: setCache } = useEntityCache.getState();
      setCache([created, ...cached]);
      return created;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create contact');
      return undefined;
    }
  }, []);

  const updateCachedContact = useCallback(async (id: string, data: Partial<ContactFormData>) => {
    try {
      const updated = await contactService.update(id, data);
      if (updated) updateContact(id, updated);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update contact');
      return undefined;
    }
  }, [updateContact]);

  const deleteCachedContact = useCallback(async (id: string) => {
    try {
      await contactService.delete(id);
      removeContact(id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete contact');
      return false;
    }
  }, [removeContact]);

  return {
    contacts,
    loading,
    error,
    refreshFromServer,
    getById,
    getByCompanyId,
    createContact,
    updateContact: updateCachedContact,
    deleteContact: deleteCachedContact,
  };
}
