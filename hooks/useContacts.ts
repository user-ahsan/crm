'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Contact, ContactFormData } from '@/types/contact.types';
import type { ContactFilters } from '@/services/contact.service';
import { generateId } from '@/lib/formatters';
import { contactService } from '@/services/contact.service';
import { searchContacts } from '@/modules/contacts/contactFilters';
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

  // Documented filter API (HOOKS.md:60) — mirrors useLeads.getFiltered:
  // a synchronous filter over the loaded state with AND semantics.
  const getFiltered = useCallback((filters: ContactFilters) => {
    let result = filters.search ? searchContacts(contacts, filters.search) : contacts;
    if (filters.companyId) result = result.filter((c) => c.companyId === filters.companyId);
    if (filters.leadId) result = result.filter((c) => c.leadIds.includes(filters.leadId));
    // Local state stores tag NAMES; the service resolves tagId → name for
    // server-side filtering. Match the stored value directly here.
    if (filters.tagId) result = result.filter((c) => c.tags.includes(filters.tagId));
    return result;
  }, [contacts]);

  const getById = useCallback(async (id: string) => {
    try {
      return await contactService.getById(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contact');
      return undefined;
    }
  }, []);

  const getByCompanyId = useCallback(async (companyId: string) => {
    try {
      return await contactService.getByCompanyId(companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contacts');
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
    // Capture the pre-mutation row OUTSIDE the state updater so rollback can
    // restore the exact object at its original index (ARCHITECTURE §10).
    const prevItem = contacts.find((c) => c.id === id);
    if (!prevItem) return undefined;
    const prevIndex = contacts.indexOf(prevItem);
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    try {
      const updated = await contactService.update(id, data);
      if (!updated) {
        // PGRST116 not-found: revert the optimistic change and surface it.
        setContacts((prev) => {
          const next = prev.filter((c) => c.id !== id);
          next.splice(Math.min(prevIndex, next.length), 0, prevItem);
          return next;
        });
        setError('Failed to update contact: record not found');
        return undefined;
      }
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
      useEntityCache.getState().updateContact(id, updated);
      return updated;
    } catch (e) {
      setContacts((prev) => {
        const next = prev.filter((c) => c.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to update contact');
      return undefined;
    }
  }, [contacts]);

  const deleteContact = useCallback(async (id: string) => {
    const prevItem = contacts.find((c) => c.id === id);
    if (!prevItem) return false;
    const prevIndex = contacts.indexOf(prevItem);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    try {
      await contactService.delete(id);
      useEntityCache.getState().removeContact(id);
      return true;
    } catch (e) {
      setContacts((prev) => {
        const next = prev.filter((c) => c.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to delete contact');
      return false;
    }
  }, [contacts]);

  return { contacts, loading, error, refresh, getFiltered, getById, getByCompanyId, createContact, updateContact, deleteContact };
}
