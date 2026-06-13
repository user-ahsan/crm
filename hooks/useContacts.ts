'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Contact, ContactFormData } from '@/types/contact.types';
import { contactService } from '@/services/contact.service';
import { useEntityCache } from '@/store/entity-cache';

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
      useEntityCache.getState().setContacts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    const tempId = `temp-${Date.now()}`;
    const optimisticItem = { ...data, id: tempId, createdAt: new Date().toISOString() } as Contact;
    setContacts((prev) => [optimisticItem, ...prev]);
    try {
      const created = await contactService.create(data);
      setContacts((prev) => prev.map((c) => (c.id === tempId ? created : c)));
      const { contacts: cached, setContacts: setCache } = useEntityCache.getState();
      setCache([created, ...cached]);
      return created;
    } catch (e) {
      setContacts((prev) => prev.filter((c) => c.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create contact');
      return undefined;
    }
  }, []);

  const updateContact = useCallback(async (id: string, data: Partial<ContactFormData>) => {
    const previous = contacts;
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    try {
      const updated = await contactService.update(id, data);
      if (updated) {
        setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
        useEntityCache.getState().updateContact(id, updated);
      }
      return updated;
    } catch (e) {
      setContacts(previous);
      setError(e instanceof Error ? e.message : 'Failed to update contact');
      return undefined;
    }
  }, [contacts]);

  const deleteContact = useCallback(async (id: string) => {
    const previous = contacts;
    setContacts((prev) => prev.filter((c) => c.id !== id));
    try {
      await contactService.delete(id);
      useEntityCache.getState().removeContact(id);
      return true;
    } catch (e) {
      setContacts(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete contact');
      return false;
    }
  }, [contacts]);

  return { contacts, loading, error, refresh, getById, getByCompanyId, createContact, updateContact, deleteContact };
}
