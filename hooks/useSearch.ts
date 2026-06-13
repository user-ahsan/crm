'use client';

import { useState, useCallback, useMemo } from 'react';
import { globalSearch, type SearchResult } from '@/modules/search/globalSearch';
import { useLeads } from '@/hooks/useLeads';
import { useContacts } from '@/hooks/useContacts';
import { useCompanies } from '@/hooks/useCompanies';
import { useTasks } from '@/hooks/useTasks';
import { useMeetings } from '@/hooks/useMeetings';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { leads } = useLeads();
  const { contacts } = useContacts();
  const { companies } = useCompanies();
  const { tasks } = useTasks();
  const { meetings } = useMeetings();

  const results = useMemo((): SearchResult[] => {
    if (query.trim().length < 1) return [];
    return globalSearch(query, leads, contacts, companies, tasks, meetings);
  }, [query, leads, contacts, companies, tasks, meetings]);

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
