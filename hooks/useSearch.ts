'use client';

import { useState, useCallback, useMemo } from 'react';
import { useDebounce } from './useDebounce';
import { globalSearch, type SearchResult } from '@/modules/search/globalSearch';
import { useLeadsCache, useContactsCache, useCompaniesCache, useTasksCache, useMeetingsCache } from '@/store/entity-cache';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 250);

  // Use individual selectors to avoid re-rendering when unrelated entities change (P6)
  const leads = useLeadsCache();
  const contacts = useContactsCache();
  const companies = useCompaniesCache();
  const tasks = useTasksCache();
  const meetings = useMeetingsCache();

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

  return { query, setQuery, results, grouped, isOpen, open, close };
}
