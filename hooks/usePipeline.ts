'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Lead, LeadStatus } from '@/types/lead.types';
import { leadService } from '@/services/lead.service';
import { buildPipeline, type PipelineStage } from '@/modules/pipeline/pipelineUtils';

export function usePipeline() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      setLeads(leadService.getAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const pipeline = useMemo(() => buildPipeline(leads), [leads]);

  const moveLead = useCallback((leadId: string, newStage: LeadStatus) => {
    try {
      const updated = leadService.updateStatus(leadId, newStage);
      if (updated) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
      }
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move lead');
      return undefined;
    }
  }, []);

  const getStageStats = useCallback(() => {
    return leadService.getPipelineStats();
  }, []);

  return { pipeline, leads, loading, error, refresh, moveLead, getStageStats };
}
