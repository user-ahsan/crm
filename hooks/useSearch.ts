'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { globalSearch, type SearchResult } from '@/modules/search/globalSearch';
import { leadService } from '@/services/lead.service';
import { contactService } from '@/services/contact.service';
import { companyService } from '@/services/company.service';
import { taskService } from '@/services/task.service';
import { meetingService } from '@/services/meeting.service';
import type { Lead } from '@/types/lead.types';
import type { Contact } from '@/types/contact.types';
import type { Company } from '@/types/company.types';
import type { Task } from '@/types/task.types';
import type { Meeting } from '@/types/meeting.types';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loaded, setLoaded] = useState(false);
  const dataRef = useRef(false);

  useEffect(() => {
    if (isOpen && !dataRef.current) {
      dataRef.current = true;
      Promise.all([
        leadService.getAll().catch(() => [] as Lead[]),
        contactService.getAll().catch(() => [] as Contact[]),
        companyService.getAll().catch(() => [] as Company[]),
        taskService.getAll().catch(() => [] as Task[]),
        meetingService.getAll().catch(() => [] as Meeting[]),
      ]).then(([l, c, co, t, m]) => {
        setLeads(l);
        setContacts(c);
        setCompanies(co);
        setTasks(t);
        setMeetings(m);
        setLoaded(true);
      });
    }
  }, [isOpen]);

  const results = useMemo((): SearchResult[] => {
    if (query.trim().length < 1) return [];
    if (!loaded && !dataRef.current) return [];
    return globalSearch(query, leads, contacts, companies, tasks, meetings);
  }, [query, leads, contacts, companies, tasks, meetings, loaded]);

  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    }
    return groups;
  }, [results]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => { setIsOpen(false); setQuery(''); dataRef.current = false; setLoaded(false); }, []);

  return { query, setQuery, results, grouped, isOpen, open, close };
}
