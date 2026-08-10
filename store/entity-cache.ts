import { create } from 'zustand';
import type { Lead } from '@/types/lead.types';
import type { Contact } from '@/types/contact.types';
import type { Company } from '@/types/company.types';
import type { Task } from '@/types/task.types';
import type { Meeting } from '@/types/meeting.types';
import type { Deal } from '@/types/deal.types';
import type { Invoice } from '@/types/invoice.types';
import type { Quote } from '@/types/quote.types';

// P8: Default stale time in milliseconds (30 seconds)
export const CACHE_STALE_TIME = 30_000;

// D19: Cache TTL — entries older than this are considered stale for cleanup
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export type EntityType = 'leads' | 'contacts' | 'companies' | 'tasks' | 'meetings' | 'deals' | 'invoices' | 'quotes';

// P8: Check if a cached entity type is fresh (was fetched recently)
export function isCacheStale(cache: { lastFetched: Record<string, number> }, entityType: EntityType): boolean {
  const lastFetch = cache.lastFetched[entityType];
  if (lastFetch === undefined) return true;
  return Date.now() - lastFetch > CACHE_STALE_TIME;
}

export interface EntityCacheState {
  leads: Lead[];
  contacts: Contact[];
  companies: Company[];
  tasks: Task[];
  deals: Deal[];
  meetings: Meeting[];
  invoices: Invoice[];
  quotes: Quote[];
  // P8: Caching metadata
  lastFetched: Record<string, number>;
  isLoading: Record<string, boolean>;
  setLeads: (leads: Lead[]) => void;
  setContacts: (contacts: Contact[]) => void;
  setCompanies: (companies: Company[]) => void;
  setTasks: (tasks: Task[]) => void;
  setDeals: (deals: Deal[]) => void;
  setMeetings: (meetings: Meeting[]) => void;
  setInvoices: (invoices: Invoice[]) => void;
  setQuotes: (quotes: Quote[]) => void;
  // P8: Caching actions
  setLastFetched: (entityType: EntityType) => void;
  setIsLoading: (entityType: EntityType, loading: boolean) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateDeal: (id: string, updates: Partial<Deal>) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  removeLead: (id: string) => void;
  removeContact: (id: string) => void;
  removeCompany: (id: string) => void;
  removeTask: (id: string) => void;
  removeDeal: (id: string) => void;
  removeMeeting: (id: string) => void;
  removeInvoice: (id: string) => void;
  removeQuote: (id: string) => void;
  clearCache: () => void;
  invalidateEntity: (type: EntityType) => void;
  // D19: Stale cache cleanup
  clearStaleCache: () => void;
}

// P6: Selector helpers — use these in components to avoid full-store re-renders
export const useLeadsCache = () => useEntityCache(state => state.leads);
export const useContactsCache = () => useEntityCache(state => state.contacts);
export const useCompaniesCache = () => useEntityCache(state => state.companies);
export const useTasksCache = () => useEntityCache(state => state.tasks);
export const useDealsCache = () => useEntityCache(state => state.deals);
export const useMeetingsCache = () => useEntityCache(state => state.meetings);
export const useInvoicesCache = () => useEntityCache(state => state.invoices);
export const useQuotesCache = () => useEntityCache(state => state.quotes);

export const useEntityCache = create<EntityCacheState>()((set) => ({
  leads: [],
  contacts: [],
  companies: [],
  tasks: [],
  deals: [],
  meetings: [],
  invoices: [],
  quotes: [],
  // P8: Caching metadata — no timestamps = stale
  lastFetched: {},
  isLoading: {},

  setLeads: (leads) => set({ leads }),
  setContacts: (contacts) => set({ contacts }),
  setCompanies: (companies) => set({ companies }),
  setTasks: (tasks) => set({ tasks }),
  setDeals: (deals) => set({ deals }),
  setMeetings: (meetings) => set({ meetings }),
  setInvoices: (invoices) => set({ invoices }),
  setQuotes: (quotes) => set({ quotes }),
  // P8: Mark entity type as fetched now
  setLastFetched: (entityType) =>
    set((state) => ({ lastFetched: { ...state.lastFetched, [entityType]: Date.now() } })),
  setIsLoading: (entityType, loading) =>
    set((state) => ({ isLoading: { ...state.isLoading, [entityType]: loading } })),

  updateLead: (id, updates) =>
    set((state) => ({
      leads: state.leads.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),
  updateContact: (id, updates) =>
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  updateCompany: (id, updates) =>
    set((state) => ({
      companies: state.companies.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  updateDeal: (id, updates) =>
    set((state) => ({
      deals: state.deals.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),
  updateMeeting: (id, updates) =>
    set((state) => ({
      meetings: state.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  updateInvoice: (id, updates) =>
    set((state) => ({
      invoices: state.invoices.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)),
    })),
  updateQuote: (id, updates) =>
    set((state) => ({
      quotes: state.quotes.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    })),

  removeLead: (id) =>
    set((state) => ({ leads: state.leads.filter((l) => l.id !== id) })),
  removeContact: (id) =>
    set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) })),
  removeCompany: (id) =>
    set((state) => ({ companies: state.companies.filter((c) => c.id !== id) })),
  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
  removeDeal: (id) =>
    set((state) => ({ deals: state.deals.filter((d) => d.id !== id) })),
  removeMeeting: (id) =>
    set((state) => ({ meetings: state.meetings.filter((m) => m.id !== id) })),
  removeInvoice: (id) =>
    set((state) => ({ invoices: state.invoices.filter((inv) => inv.id !== id) })),
  removeQuote: (id) =>
    set((state) => ({ quotes: state.quotes.filter((q) => q.id !== id) })),

  clearCache: () =>
    set({
      leads: [], contacts: [], companies: [], tasks: [], deals: [], meetings: [],
      invoices: [], quotes: [],
      lastFetched: {},
      isLoading: {},
    }),

  invalidateEntity: (type) =>
    set((state) => ({
      lastFetched: { ...state.lastFetched, [type]: 0 },
    })),

  // D19: Remove stale entries from cache
  clearStaleCache: () => {
    const now = Date.now();
    set((state) => {
      const staleTypes = Object.entries(state.lastFetched)
        .filter(([, ts]) => now - ts > CACHE_TTL)
        .map(([type]) => type);

      if (staleTypes.length === 0) return state;

      const updates: Partial<EntityCacheState> = {
        lastFetched: { ...state.lastFetched },
        isLoading: { ...state.isLoading },
      };
      for (const type of staleTypes) {
        // Clear the data array + loading flag for stale entity types
        if (type === 'leads') updates.leads = [];
        else if (type === 'contacts') updates.contacts = [];
        else if (type === 'companies') updates.companies = [];
        else if (type === 'tasks') updates.tasks = [];
        else if (type === 'meetings') updates.meetings = [];
        else if (type === 'deals') updates.deals = [];
        else if (type === 'invoices') updates.invoices = [];
        else if (type === 'quotes') updates.quotes = [];
        updates.lastFetched[type] = 0;
        updates.isLoading[type] = false;
      }
      return updates;
    });
  },
}));
