'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Lead, LeadStatus, LeadPriority } from '@/types/lead.types';
import type { SwimlaneGroup } from '@/types/swimlane.types';
import type { WorkflowEntityType } from '@/types/workflow.types';
import { leadService } from '@/services/lead.service';
import { buildPipeline, getWorkflowStages, type PipelineStage, type StageDefinition } from '@/modules/pipeline/pipelineUtils';
import { LEAD_PRIORITIES, LEAD_STATUSES, PIPELINE_STAGES } from '@/lib/constants';
import { getUserName } from '@/lib/user-utils';
import { useEntityCache } from '@/store/entity-cache';

/** A single swimlane entry — a group with its own filtered pipeline stages */
export interface SwimlaneEntry {
  id: string;
  label: string;
  pipeline: PipelineStage[];
  totalLeads: number;
  totalValue: number;
}

/** Type guard: a stage key is a valid lead status (the DB enum holds exactly these six values). */
function isValidLeadStatus(stage: string): stage is LeadStatus {
  return LEAD_STATUSES.some((s) => s === stage);
}

export function usePipeline(entityType: WorkflowEntityType = 'lead') {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swimlaneGroup, setSwimlaneGroup] = useState<SwimlaneGroup>('none');

  // ── Workflow stages state ───────────────────────────────────────
  const [workflowStages, setWorkflowStages] = useState<StageDefinition[]>(PIPELINE_STAGES);
  const [workflowStagesLoading, setWorkflowStagesLoading] = useState(true);

  // Load custom workflow stages for the given entity type
  const loadWorkflowStages = useCallback(async () => {
    setWorkflowStagesLoading(true);
    try {
      const stages = await getWorkflowStages(entityType);
      setWorkflowStages(stages);
    } catch {
      // Fallback already handled inside getWorkflowStages; keep defaults
      setWorkflowStages(PIPELINE_STAGES);
    } finally {
      setWorkflowStagesLoading(false);
    }
  }, [entityType]);

  // Reload stages when entity type changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWorkflowStages();
  }, [loadWorkflowStages]);

  // ── Leads loading ───────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await leadService.getAll();
      setLeads(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, []);

  // Mount effect delegates to refresh() instead of duplicating the fetch
  // body (P3 audit: duplicated initial-load logic risks divergence).
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Build the pipeline using either custom workflow stages or default stages.
  // For 'lead' entity: lead.status is constrained to the six built-in values
  // (LEAD_STATUSES), so custom UUID-keyed workflow states would produce empty
  // columns and invalid drop targets. Filter to only built-in-compatible stages.
  const pipeline = useMemo(() => {
    let stages = workflowStages.length > 0 ? workflowStages : undefined;
    if (entityType === 'lead' && stages) {
      const validKeys = new Set<string>(LEAD_STATUSES);
      const filtered = stages.filter((s) => validKeys.has(s.key));
      stages = filtered.length > 0 ? filtered : undefined;
    }
    return buildPipeline(leads, stages);
  }, [leads, workflowStages, entityType]);

  const moveLead = useCallback(async (leadId: string, newStage: string) => {
    // Transition validation FIRST — lead.status is constrained to the six
    // built-in values, so custom workflow UUID stages (which are valid for
    // deals/tasks) must never be written onto a lead (C10/F5 fix).
    if (!isValidLeadStatus(newStage)) {
      const message = `Cannot move lead to "${newStage}": lead status is limited to the six built-in stages (${LEAD_STATUSES.join(', ')}). Custom workflow states are only available for deals and tasks.`;
      setError(message);
      return undefined;
    }

    // Capture the previous lead BEFORE the optimistic mutation so the
    // failure path can restore it (ARCHITECTURE §10 reversible updates).
    let previous: Lead | undefined;
    setLeads((prev) => {
      previous = prev.find((l) => l.id === leadId);
      return prev.map((l) => (l.id === leadId ? { ...l, status: newStage } : l));
    });
    // Sync the entity cache optimistically so cache-backed views (global
    // search, freshly hydrated lists) see the move immediately (C12).
    useEntityCache.getState().updateLead(leadId, { status: newStage });

    try {
      const updated = await leadService.updateStatus(leadId, newStage);
      if (updated) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
        // Cache now holds the server-confirmed row; invalidate the freshness
        // stamp so a freshly mounted useLeads refetches instead of hydrating
        // stale stage data (C12).
        useEntityCache.getState().updateLead(leadId, updated);
        useEntityCache.getState().invalidateEntity('leads');
      }
      return updated;
    } catch (e) {
      if (previous) {
        setLeads((prev) => prev.map((l) => (l.id === leadId && previous ? { ...l, status: previous.status } : l)));
        useEntityCache.getState().updateLead(leadId, { status: previous.status });
      }
      setError(e instanceof Error ? e.message : 'Failed to move lead');
      return undefined;
    }
  }, []);

  // For 'lead' entity, surface only built-in-compatible stages to consumers
  // (KanbanBoard skeleton count, swimlane column resolution, etc.).
  const effectiveWorkflowStages = useMemo(() => {
    if (entityType !== 'lead') return workflowStages;
    const validKeys = new Set<string>(LEAD_STATUSES);
    const filtered = workflowStages.filter((s) => validKeys.has(s.key));
    return filtered.length > 0 ? filtered : PIPELINE_STAGES;
  }, [entityType, workflowStages]);

  const getStageStats = useCallback(async () => {
    try {
      return await leadService.getPipelineStats();
    } catch {
      return null;
    }
  }, []);

  /** Build grouped pipeline data based on the selected swimlane group */
  const swimlaneData = useMemo<SwimlaneEntry[]>(() => {
    if (swimlaneGroup === 'none') return [];

    if (swimlaneGroup === 'assigned_to') {
      const assigneeMap = new Map<string, Lead[]>();
      const unassigned: Lead[] = [];
      for (const lead of leads) {
        if (lead.assignedTo) {
          const list = assigneeMap.get(lead.assignedTo);
          if (list) list.push(lead);
          else assigneeMap.set(lead.assignedTo, [lead]);
        } else {
          unassigned.push(lead);
        }
      }
      const entries: SwimlaneEntry[] = [];
      for (const [id, groupLeads] of assigneeMap) {
        const stages = effectiveWorkflowStages.length > 0 ? effectiveWorkflowStages : undefined;
        const p = buildPipeline(groupLeads, stages);
        entries.push({
          id,
          label: getUserName(id, 'Unassigned'),
          pipeline: p,
          totalLeads: groupLeads.length,
          totalValue: groupLeads.reduce((s, l) => s + l.estimatedValue, 0),
        });
      }
      if (unassigned.length > 0) {
        const stages = effectiveWorkflowStages.length > 0 ? effectiveWorkflowStages : undefined;
        const p = buildPipeline(unassigned, stages);
        entries.push({
          id: 'unassigned',
          label: 'Unassigned',
          pipeline: p,
          totalLeads: unassigned.length,
          totalValue: unassigned.reduce((s, l) => s + l.estimatedValue, 0),
        });
      }
      return entries;
    }

    if (swimlaneGroup === 'priority') {
      const priorityMap = new Map<LeadPriority, Lead[]>();
      for (const p of LEAD_PRIORITIES) priorityMap.set(p, []);
      const unset: Lead[] = [];
      for (const lead of leads) {
        const list = priorityMap.get(lead.priority);
        if (list) list.push(lead);
        else unset.push(lead);
      }
      const priorityOrder: LeadPriority[] = ['high', 'medium', 'low'];
      const entries: SwimlaneEntry[] = [];
      for (const p of priorityOrder) {
        const groupLeads = priorityMap.get(p) ?? [];
        if (groupLeads.length > 0) {
          const stages = effectiveWorkflowStages.length > 0 ? effectiveWorkflowStages : undefined;
          const pipe = buildPipeline(groupLeads, stages);
          entries.push({
            id: p,
            label: p.charAt(0).toUpperCase() + p.slice(1),
            pipeline: pipe,
            totalLeads: groupLeads.length,
            totalValue: groupLeads.reduce((s, l) => s + l.estimatedValue, 0),
          });
        }
      }
      if (unset.length > 0) {
        const stages = effectiveWorkflowStages.length > 0 ? effectiveWorkflowStages : undefined;
        const p = buildPipeline(unset, stages);
        entries.push({
          id: 'unset',
          label: 'Unset',
          pipeline: p,
          totalLeads: unset.length,
          totalValue: unset.reduce((s, l) => s + l.estimatedValue, 0),
        });
      }
      return entries;
    }

    // 'status' group: use effective workflow stages for the status mapping
    return effectiveWorkflowStages.map((s) => {
      const groupLeads = leads.filter((l) => l.status === s.key);
      const p = buildPipeline(groupLeads, effectiveWorkflowStages);
      return {
        id: s.key,
        label: s.label,
        pipeline: p,
        totalLeads: groupLeads.length,
        totalValue: groupLeads.reduce((sum, l) => sum + l.estimatedValue, 0),
      };
    }).filter((e) => e.totalLeads > 0);
  }, [leads, swimlaneGroup, effectiveWorkflowStages]);

  return {
    pipeline,
    leads,
    loading,
    error,
    refresh,
    moveLead,
    getStageStats,
    swimlaneGroup,
    setSwimlaneGroup,
    swimlaneData,
    workflowStages: effectiveWorkflowStages,
    workflowStagesLoading,
  };
}
