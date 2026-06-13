import type { Lead, LeadFilters } from '@/types/lead.types';

export function applyLeadFilters(leads: Lead[], filters: LeadFilters): Lead[] {
  return leads.filter((lead) => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const matchesSearch =
        lead.fullName.toLowerCase().includes(s) ||
        lead.email?.toLowerCase().includes(s) ||
        lead.companyName?.toLowerCase().includes(s) ||
        lead.tags.some((t) => t.toLowerCase().includes(s));
      if (!matchesSearch) return false;
    }
    if (filters.status && lead.status !== filters.status) return false;
    if (filters.source && lead.source !== filters.source) return false;
    if (filters.priority && lead.priority !== filters.priority) return false;
    if (filters.assignedTo && lead.assignedTo !== filters.assignedTo) return false;
    return true;
  });
}

export function sortLeads(leads: Lead[], by: 'createdAt' | 'updatedAt' | 'estimatedValue' = 'createdAt', dir: 'asc' | 'desc' = 'desc'): Lead[] {
  return [...leads].sort((a, b) => {
    const valA = a[by];
    const valB = b[by];
    const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
    return dir === 'desc' ? -cmp : cmp;
  });
}
