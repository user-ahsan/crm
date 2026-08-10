'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDebounce } from './useDebounce';
import { globalSearch, type SearchResult } from '@/modules/search/globalSearch';
import { useEntityCache, useLeadsCache, useContactsCache, useCompaniesCache, useTasksCache, useMeetingsCache } from '@/store/entity-cache';
import { leadService } from '@/services/lead.service';
import { contactService } from '@/services/contact.service';
import { companyService } from '@/services/company.service';
import { taskService } from '@/services/task.service';
import { meetingService } from '@/services/meeting.service';

type SearchableEntity = 'leads' | 'contacts' | 'companies' | 'tasks' | 'meetings';

const SEARCHABLE_ENTITIES: SearchableEntity[] = ['leads', 'contacts', 'companies', 'tasks', 'meetings'];

export function useSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 250);

  // In-flight guard so concurrent ensures never double-fetch the same entity.
  const fetchingRef = useRef<Record<SearchableEntity, boolean>>({
    leads: false,
    contacts: false,
    companies: false,
    tasks: false,
    meetings: false,
  });

  // Use individual selectors to avoid re-rendering when unrelated entities change (P6)
  const leads = useLeadsCache();
  const contacts = useContactsCache();
  const companies = useCompaniesCache();
  const tasks = useTasksCache();
  const meetings = useMeetingsCache();

  /**
   * Cold-cache fallback: when an entity's cache has never been fetched (empty
   * array and no lastFetched stamp), fetch the full dataset on demand and
   * populate the cache so the first Cmd+K search returns real results instead
   * of zero (P1 audit: search was 100% dependent on a warm cache). Guards:
   *   - data already present                  → no-op
   *   - previously fetched (even genuinely empty) → no-op (no refetch loops)
   *   - a fetch is already in flight          → no-op
   * A failed fetch leaves lastFetched unstamped so the next search retries.
   */
  const ensureLoaded = useCallback(async (entity: SearchableEntity) => {
    const store = useEntityCache.getState();
    if (store[entity].length > 0) return;
    if (store.lastFetched[entity] !== undefined) return;
    if (store.isLoading[entity] || fetchingRef.current[entity]) return;
    fetchingRef.current[entity] = true;
    setError(null);
    try {
      switch (entity) {
        case 'leads': {
          const data = await leadService.getAll();
          store.setLeads(data);
          break;
        }
        case 'contacts': {
          const data = await contactService.getAll();
          store.setContacts(data);
          break;
        }
        case 'companies': {
          const data = await companyService.getAll();
          store.setCompanies(data);
          break;
        }
        case 'tasks': {
          const data = await taskService.getAll();
          store.setTasks(data);
          break;
        }
        case 'meetings': {
          const data = await meetingService.getAll();
          store.setMeetings(data);
          break;
        }
      }
      store.setLastFetched(entity);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to load ${entity} for search`);
    } finally {
      fetchingRef.current[entity] = false;
    }
  }, []);

  // Warm (or retry after failure) entity caches on mount and whenever the
  // user searches. The guards inside ensureLoaded prevent refetch loops.
  useEffect(() => {
    for (const entity of SEARCHABLE_ENTITIES) {
      void ensureLoaded(entity);
    }
  }, [ensureLoaded, debouncedQuery]);

  const results = useMemo((): SearchResult[] => {
    if (debouncedQuery.trim().length < 1) return [];
    return globalSearch(debouncedQuery, leads, contacts, companies, tasks, meetings);
  }, [debouncedQuery, leads, contacts, companies, tasks, meetings]);

  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    }
    return groups;
  }, [results]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => { setIsOpen(false); setQuery(''); }, []);

  // Documented imperative API (HOOKS.md §useSearch): search / isSearching / clearSearch
  const search = useCallback((q: string) => {
    setIsOpen(true);
    setQuery(q);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  // True while the debounce is still pending (the typed query differs from
  // the query the results are computed from).
  const isSearching = debouncedQuery !== query;

  return {
    query,
    setQuery,
    results,
    grouped,
    isOpen,
    open,
    close,
    search,
    isSearching,
    clearSearch,
    error,
  };
}
