import type { Lead, LeadStatus } from '@/types/lead.types';
import type { WorkflowState, WorkflowEntityType } from '@/types/workflow.types';
import { LEAD_STATUSES, PIPELINE_STAGES } from '@/lib/constants';
import { workflowService } from '@/services/workflow.service';

/**
 * A stage definition used to configure kanban column rendering.
 * Used both for hardcoded PIPELINE_STAGES and dynamic workflow states.
 */
export interface StageDefinition {
  key: string;
  label: string;
  color: string;
}

export interface PipelineStage {
  key: string;
  label: string;
  leads: Lead[];
  totalValue: number;
  count: number;
}

/**
 * Convert a WorkflowState into the StageDefinition format used by the kanban.
 * The state ID becomes the stage key, the state name becomes the label,
 * and the state color is used as an inline CSS color for the column header border.
 */
export function mapWorkflowStateToStage(state: WorkflowState): StageDefinition {
  return {
    key: state.id,
    label: state.name,
    color: state.color,
  };
}

/**
 * Load custom workflow stages for an entity type from the workflow service.
 * Falls back to the hardcoded PIPELINE_STAGES when:
 *  - No custom workflow states exist for the given entity type
 *  - The workflow service call fails
 *
 * Returns stages as StageDefinition[] in the same { key, label, color } format.
 */
export async function getWorkflowStages(entityType: WorkflowEntityType): Promise<StageDefinition[]> {
  try {
    const states = await workflowService.getStates(entityType);
    if (states.length > 0) {
      return states.map(mapWorkflowStateToStage);
    }
  } catch {
    // Service failure — silently fall back to default PIPELINE_STAGES
  }
  return PIPELINE_STAGES;
}

/**
 * Build the pipeline data structure from an array of leads.
 *
 * When `stageDefs` is provided, uses those stage definitions as the grouping
 * keys — each lead's `status` field is matched against the stage key. This
 * supports both LeadStatus values (default) and workflow state IDs (custom).
 *
 * When `stageDefs` is omitted or empty, falls back to the hardcoded
 * LEAD_STATUSES and PIPELINE_STAGES for backward-compatible behavior.
 */
export function buildPipeline(leads: Lead[], stageDefs?: StageDefinition[]): PipelineStage[] {
  if (stageDefs && stageDefs.length > 0) {
    const stageMap = new Map<string, Lead[]>();
    for (const stage of stageDefs) {
      stageMap.set(stage.key, []);
    }
    for (const lead of leads) {
      const list = stageMap.get(lead.status);
      if (list) list.push(lead);
    }
    return stageDefs.map((stage) => {
      const stageLeads = stageMap.get(stage.key) ?? [];
      return {
        key: stage.key,
        label: stage.label,
        leads: stageLeads,
        totalValue: stageLeads.reduce((sum, l) => sum + l.estimatedValue, 0),
        count: stageLeads.length,
      };
    });
  }

  // Default fallback: group by LEAD_STATUSES
  const stageMap = new Map<LeadStatus, Lead[]>();
  for (const status of LEAD_STATUSES) {
    stageMap.set(status, []);
  }
  for (const lead of leads) {
    const list = stageMap.get(lead.status);
    if (list) list.push(lead);
  }
  const labelMap = new Map(PIPELINE_STAGES.map(s => [s.key, s.label]));
  return LEAD_STATUSES.map((key) => {
    const stageLeads = stageMap.get(key) ?? [];
    return {
      key,
      label: labelMap.get(key) ?? key.charAt(0).toUpperCase() + key.slice(1),
      leads: stageLeads,
      totalValue: stageLeads.reduce((sum, l) => sum + l.estimatedValue, 0),
      count: stageLeads.length,
    };
  });
}

/**
 * Determine whether a stage key corresponds to a custom workflow stage (UUID)
 * or a hardcoded default stage (LeadStatus value).
 */
export function isCustomStage(stageKey: string): boolean {
  return !LEAD_STATUSES.includes(stageKey as LeadStatus);
}
