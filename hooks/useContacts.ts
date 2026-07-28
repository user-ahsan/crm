'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Contact, ContactFormData } from '@/types/contact.types';
import { generateId } from '@/lib/formatters';
import { contactService } from '@/services/contact.service';
import { useEntityCache, isCacheStale } from '@/store/entity-cache';

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
      const store = useEntityCache.getState();
      store.setContacts(data);
      store.setLastFetched('contacts');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // P8: Skip fetch if cache is fresh
    const store = useEntityCache.getState();
    if (!isCacheStale(store, 'contacts') && store.contacts.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContacts(store.contacts);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const getById = useCallback(async (id: string) => {
    try {
      return await contactService.getById(id);
    } catch {
      // Error preserved in error state
      return undefined;
    }
  }, []);

  const getByCompanyId = useCallback(async (companyId: string) => {
    try {
      return await contactService.getByCompanyId(companyId);
    } catch {
      // Error preserved in error state
      return [];
    }
  }, []);

  const createContact = useCallback(async (data: ContactFormData) => {
    const tempId = generateId();
    const optimisticItem: Contact = {
      id: tempId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      jobTitle: data.jobTitle,
      companyId: data.companyId,
      leadIds: [],
      location: data.location,
      socialLinks: data.socialLinks ?? [],
      tags: data.tags ?? [],
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
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
    let prevItem: Contact | undefined;
    setContacts((prev) => {
      prevItem = prev.find((c) => c.id === id);
      return prev.map((c) => (c.id === id ? { ...c, ...data } : c));
    });
    try {
      const updated = await contactService.update(id, data);
      if (updated) {
        setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
        useEntityCache.getState().updateContact(id, updated);
      }
      return updated;
    } catch (e) {
      if (prevItem) setContacts((prev) => prev.map((c) => (c.id === id ? prevItem! : c)));
      setError(e instanceof Error ? e.message : 'Failed to update contact');
      return undefined;
    }
  }, []);

  const deleteContact = useCallback(async (id: string) => {
    let prevItem: Contact | undefined;
    setContacts((prev) => {
      prevItem = prev.find((c) => c.id === id);
      return prev.filter((c) => c.id !== id);
    });
    try {
      await contactService.delete(id);
      useEntityCache.getState().removeContact(id);
      return true;
    } catch (e) {
      if (prevItem) setContacts((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete contact');
      return false;
    }
  }, []);

  return { contacts, loading, error, refresh, getById, getByCompanyId, createContact, updateContact, deleteContact };
}
