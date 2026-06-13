'use client';

import { useState, useCallback, useMemo } from 'react';
import { globalSearch, type SearchResult } from '@/modules/search/globalSearch';
import { leads } from '@/data/leads';
import { contacts } from '@/data/contacts';
import { companies } from '@/data/companies';
import { tasks } from '@/data/tasks';
import { meetings } from '@/data/meetings';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const results = useMemo((): SearchResult[] => {
    if (query.trim().length < 1) return [];
    return globalSearch(query, leads, contacts, companies, tasks, meetings);
  }, [query]);

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
