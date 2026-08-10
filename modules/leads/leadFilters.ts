import type { Lead, LeadFilters } from '@/types/lead.types';
import type { LeadScore } from '@/types/lead-scoring.types';

export function applyLeadFilters(leads: Lead[], filters: LeadFilters, scores?: Map<string, LeadScore>): Lead[] {
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
    if (filters.assignedTo) {
      if (filters.assignedTo === 'unassigned') {
        if (lead.assignedTo) return false;
      } else if (lead.assignedTo !== filters.assignedTo) {
        return false;
      }
    }
    if (filters.minScore && scores) {
      const score = scores.get(lead.id);
      if (!score || score.score < filters.minScore) return false;
    }
    return true;
  });
}

export type LeadSortKey =
  | 'createdAt'
  | 'updatedAt'
  | 'estimatedValue'
  | 'fullName'
  | 'companyName'
  | 'status'
  | 'priority';

export function sortLeads(
  leads: Lead[],
  by: LeadSortKey = 'createdAt',
  dir: 'asc' | 'desc' = 'desc',
): Lead[] {
  return [...leads].sort((a, b) => {
    const valA = a[by];
    const valB = b[by];
    const cmp =
      valA === undefined
        ? valB === undefined
          ? 0
          : 1
        : valB === undefined
          ? -1
          : valA < valB
            ? -1
            : valA > valB
              ? 1
              : 0;
    return dir === 'desc' ? -cmp : cmp;
  });
}
