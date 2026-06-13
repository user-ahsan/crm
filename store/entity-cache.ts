import { create } from 'zustand';
import type { Lead } from '@/types/lead.types';
import type { Contact } from '@/types/contact.types';
import type { Company } from '@/types/company.types';
import type { Task } from '@/types/task.types';
import type { Meeting } from '@/types/meeting.types';

export interface EntityCacheState {
  leads: Lead[];
  contacts: Contact[];
  companies: Company[];
  tasks: Task[];
  meetings: Meeting[];
  setLeads: (leads: Lead[]) => void;
  setContacts: (contacts: Contact[]) => void;
  setCompanies: (companies: Company[]) => void;
  setTasks: (tasks: Task[]) => void;
  setMeetings: (meetings: Meeting[]) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  removeLead: (id: string) => void;
  removeContact: (id: string) => void;
  removeCompany: (id: string) => void;
  removeTask: (id: string) => void;
  removeMeeting: (id: string) => void;
}

export const useEntityCache = create<EntityCacheState>()((set) => ({
  leads: [],
  contacts: [],
  companies: [],
  tasks: [],
  meetings: [],

  setLeads: (leads) => set({ leads }),
  setContacts: (contacts) => set({ contacts }),
  setCompanies: (companies) => set({ companies }),
  setTasks: (tasks) => set({ tasks }),
  setMeetings: (meetings) => set({ meetings }),

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
  updateMeeting: (id, updates) =>
    set((state) => ({
      meetings: state.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  removeLead: (id) =>
    set((state) => ({ leads: state.leads.filter((l) => l.id !== id) })),
  removeContact: (id) =>
    set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) })),
  removeCompany: (id) =>
    set((state) => ({ companies: state.companies.filter((c) => c.id !== id) })),
  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
  removeMeeting: (id) =>
    set((state) => ({ meetings: state.meetings.filter((m) => m.id !== id) })),
}));
