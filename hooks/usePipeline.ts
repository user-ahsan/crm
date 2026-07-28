'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Lead, LeadStatus, LeadPriority } from '@/types/lead.types';
import type { SwimlaneGroup } from '@/types/swimlane.types';
import type { WorkflowEntityType } from '@/types/workflow.types';
import { leadService } from '@/services/lead.service';
import { buildPipeline, getWorkflowStages, type PipelineStage, type StageDefinition } from '@/modules/pipeline/pipelineUtils';
import { LEAD_PRIORITIES, PIPELINE_STAGES } from '@/lib/constants';

/** A single swimlane entry — a group with its own filtered pipeline stages */
export interface SwimlaneEntry {
  id: string;
  label: string;
  pipeline: PipelineStage[];
  totalLeads: number;
  totalValue: number;
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await leadService.getAll();
        if (!cancelled) setLeads(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load pipeline');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build the pipeline using either custom workflow stages or default stages
  const pipeline = useMemo(() => {
    const stages = workflowStages.length > 0 ? workflowStages : undefined;
    return buildPipeline(leads, stages);
  }, [leads, workflowStages]);

  const moveLead = useCallback(async (leadId: string, newStage: string) => {
    try {
      const updated = await leadService.updateStatus(leadId, newStage as LeadStatus);
      if (updated) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
      }
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move lead');
      return undefined;
    }
  }, []);

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
        const stages = workflowStages.length > 0 ? workflowStages : undefined;
        const p = buildPipeline(groupLeads, stages);
        entries.push({
          id,
          label: id,
          pipeline: p,
          totalLeads: groupLeads.length,
          totalValue: groupLeads.reduce((s, l) => s + l.estimatedValue, 0),
        });
      }
      if (unassigned.length > 0) {
        const stages = workflowStages.length > 0 ? workflowStages : undefined;
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
          const stages = workflowStages.length > 0 ? workflowStages : undefined;
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
        const stages = workflowStages.length > 0 ? workflowStages : undefined;
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

    // 'status' group: use workflow stages for the status mapping
    return workflowStages.map((s) => {
      const groupLeads = leads.filter((l) => l.status === s.key);
      const p = buildPipeline(groupLeads, workflowStages);
      return {
        id: s.key,
        label: s.label,
        pipeline: p,
        totalLeads: groupLeads.length,
        totalValue: groupLeads.reduce((sum, l) => sum + l.estimatedValue, 0),
      };
    }).filter((e) => e.totalLeads > 0);
  }, [leads, swimlaneGroup, workflowStages]);

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
    workflowStages,
    workflowStagesLoading,
  };
}
