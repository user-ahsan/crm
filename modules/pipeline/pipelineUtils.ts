import type { Lead, LeadStatus } from '@/types/lead.types';
import { LEAD_STATUSES } from '@/lib/constants';

export interface PipelineStage {
  key: LeadStatus;
  label: string;
  leads: Lead[];
  totalValue: number;
  count: number;
}

export function buildPipeline(leads: Lead[]): PipelineStage[] {
  const stageMap = new Map<LeadStatus, Lead[]>();
  for (const status of LEAD_STATUSES) {
    stageMap.set(status, []);
  }
  for (const lead of leads) {
    const list = stageMap.get(lead.status);
    if (list) list.push(lead);
  }
  return LEAD_STATUSES.map((key) => {
    const stageLeads = stageMap.get(key) ?? [];
    return {
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      leads: stageLeads,
      totalValue: stageLeads.reduce((sum, l) => sum + l.estimatedValue, 0),
      count: stageLeads.length,
    };
  });
}
