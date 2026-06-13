'use client';

import { useCallback } from 'react';
import type { Lead } from '@/types/lead.types';
import type { LeadStatus } from '@/types/lead.types';
import { usePipeline } from '@/hooks/usePipeline';
import { KanbanColumn } from '@/components/pipeline/KanbanColumn';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PIPELINE_STAGES } from '@/lib/constants';
import { IconRefresh, IconAlertTriangle } from '@tabler/icons-react';

export function KanbanBoard() {
  const { pipeline, loading, error, refresh, moveLead } = usePipeline();

  const handleDrop = useCallback(
    (leadId: string, stageKey: string) => {
      const updated = moveLead(leadId, stageKey as LeadStatus);
      if (!updated) {
        // Error is already set in the hook via setError
        console.error('Failed to move lead to stage:', stageKey);
      }
    },
    [moveLead]
  );

  const handleLeadClick = useCallback((lead: Lead) => {
    // Navigate to lead detail page — in a real app this would use router.push
    // For now, we could dispatch a custom event or show a detail overlay
    window.location.href = `/leads/${lead.id}`;
  }, []);

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <IconAlertTriangle size={24} className="text-destructive" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-foreground">Failed to load pipeline</h3>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <IconRefresh size={14} />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Pipeline</h2>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {pipeline.reduce((sum, s) => sum + s.count, 0)} leads
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh pipeline"
        >
          <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.key}
              className="flex w-72 flex-shrink-0 flex-col gap-3 rounded-2xl border border-border/50 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-6 rounded-full" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Kanban columns in horizontal scroll */
        <div className="flex gap-3 overflow-x-auto pb-4">
          {pipeline.map((stage) => {
            const stageConfig = PIPELINE_STAGES.find((s) => s.key === stage.key);
            return (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                accentColor={stageConfig?.color ?? 'border-t-gray-500'}
                onDrop={handleDrop}
                onLeadClick={handleLeadClick}
              />
            );
          })}

          {/* Empty state if no pipeline stages */}
          {pipeline.length === 0 && (
            <div className="flex w-full items-center justify-center py-16">
              <div className="text-center">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  No pipeline data
                </h3>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Add leads to see them in the pipeline
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
