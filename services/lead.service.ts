import { leads } from '@/data/leads';
import { activities } from '@/data/activities';
import type { Lead, LeadFormData, LeadFilters } from '@/types/lead.types';
import { generateId } from '@/lib/formatters';

function addActivity(entityType: string, entityId: string, type: string, description: string, metadata?: Record<string, unknown>): void {
  activities.push({
    id: `act-${generateId().slice(0, 8)}`,
    entityType,
    entityId,
    type: type as any,
    description,
    metadata,
    timestamp: new Date().toISOString(),
  });
}

export const leadService = {
  getAll(): Lead[] {
    return [...leads];
  },

  getById(id: string): Lead | undefined {
    return leads.find((l) => l.id === id);
  },

  getFiltered(filters: LeadFilters): Lead[] {
    return leads.filter((lead) => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (
          !lead.fullName.toLowerCase().includes(s) &&
          !lead.email?.toLowerCase().includes(s) &&
          !lead.companyName?.toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      if (filters.status && lead.status !== filters.status) return false;
      if (filters.source && lead.source !== filters.source) return false;
      if (filters.priority && lead.priority !== filters.priority) return false;
      if (filters.assignedTo && lead.assignedTo !== filters.assignedTo) return false;
      return true;
    });
  },

  create(data: LeadFormData): Lead {
    const now = new Date().toISOString();
    const newLead: Lead = {
      ...data,
      id: `lead-${generateId().slice(0, 8)}`,
      tags: data.tags || [],
      estimatedValue: data.estimatedValue || 0,
      createdAt: now,
      updatedAt: now,
    };
    leads.unshift(newLead);
    addActivity('lead', newLead.id, 'created', `Lead created: ${newLead.fullName}${newLead.companyName ? ` from ${newLead.companyName}` : ''}`, {
      source: newLead.source,
      value: newLead.estimatedValue,
    });
    return newLead;
  },

  update(id: string, data: Partial<LeadFormData>): Lead | undefined {
    const index = leads.findIndex((l) => l.id === id);
    if (index === -1) return undefined;

    const oldStatus = leads[index].status;
    const updated = {
      ...leads[index],
      ...data,
      tags: data.tags ?? leads[index].tags,
      updatedAt: new Date().toISOString(),
    };
    leads[index] = updated;

    if (data.status && data.status !== oldStatus) {
      addActivity('lead', id, 'status_changed', `Status changed: ${oldStatus} → ${data.status}`, {
        from: oldStatus,
        to: data.status,
      });
    }
    addActivity('lead', id, 'updated', `Lead updated: ${updated.fullName}`);
    return updated;
  },

  delete(id: string): boolean {
    const index = leads.findIndex((l) => l.id === id);
    if (index === -1) return false;
    const deleted = leads[index];
    leads.splice(index, 1);
    addActivity('lead', id, 'deleted', `Lead deleted: ${deleted.fullName}`);
    return true;
  },

  updateStatus(id: string, status: Lead['status']): Lead | undefined {
    return this.update(id, { status });
  },

  getPipelineStats(): Record<Lead['status'], { count: number; value: number }> {
    const stats: Record<string, { count: number; value: number }> = {
      new: { count: 0, value: 0 },
      contacted: { count: 0, value: 0 },
      qualified: { count: 0, value: 0 },
      proposal: { count: 0, value: 0 },
      won: { count: 0, value: 0 },
      lost: { count: 0, value: 0 },
    };
    for (const lead of leads) {
      if (stats[lead.status]) {
        stats[lead.status].count++;
        stats[lead.status].value += lead.estimatedValue;
      }
    }
    return stats;
  },

  getDashboardKPIs() {
    const totalLeads = leads.length;
    const activeDeals = leads.filter((l) => !['won', 'lost'].includes(l.status)).length;
    const wonDeals = leads.filter((l) => l.status === 'won').length;
    const revenueEstimate = leads
      .filter((l) => l.status === 'won')
      .reduce((sum, l) => sum + l.estimatedValue, 0);
    const pipelineValue = leads
      .filter((l) => !['won', 'lost'].includes(l.status))
      .reduce((sum, l) => sum + l.estimatedValue, 0);

    return { totalLeads, activeDeals, wonDeals, revenueEstimate, pipelineValue };
  },
};
