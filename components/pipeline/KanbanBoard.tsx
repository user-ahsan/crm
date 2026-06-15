'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Lead } from '@/types/lead.types';
import type { LeadStatus } from '@/types/lead.types';
import type { SwimlaneGroup } from '@/types/swimlane.types';
import type { SwimlaneEntry } from '@/hooks/usePipeline';
import { usePipeline } from '@/hooks/usePipeline';
import { KanbanColumn } from '@/components/pipeline/KanbanColumn';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PIPELINE_STAGES, USERS, STATUS_COLORS } from '@/lib/constants';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  IconRefresh,
  IconAlertTriangle,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';

interface KanbanBoardProps {
  /** When provided, the board renders swimlane sections instead of a flat pipeline */
  swimlaneGroup?: SwimlaneGroup;
  /** Pre-computed grouped data used when swimlaneGroup is not 'none' */
  swimlaneData?: SwimlaneEntry[];
}

export function KanbanBoard({ swimlaneGroup, swimlaneData }: KanbanBoardProps = {}) {
  const router = useRouter();
  const { pipeline, loading, error, refresh, moveLead } = usePipeline();

  const handleDrop = useCallback(
    (leadId: string, stageKey: string) => {
      const updated = moveLead(leadId, stageKey as LeadStatus);
      if (!updated) {
        toast.error(`Failed to move lead to stage: ${stageKey}`);
      }
    },
    [moveLead]
  );

  const handleLeadClick = useCallback((lead: Lead) => {
    router.push(`/leads/${lead.id}`);
  }, [router]);

  const totalLeads = pipeline.reduce((sum, s) => sum + s.count, 0);

  // ---------- Swimlane rendering ----------

  if (swimlaneGroup && swimlaneGroup !== 'none' && swimlaneData) {
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

    if (loading && totalLeads === 0) {
      return (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border p-4">
              <Skeleton className="mb-3 h-6 w-48" />
              <div className="flex gap-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-48 w-72 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (swimlaneData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center">
            <IconUsers size={24} className="text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">No grouped data</h3>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {swimlaneGroup === 'assigned_to'
                ? 'No leads are assigned to any user'
                : swimlaneGroup === 'priority'
                  ? 'No leads with priority set'
                  : 'No leads to display'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        {swimlaneData.map((entry) => {
          const allEmpty = entry.pipeline.every((s) => s.count === 0);
          return (
            <div key={entry.id} className="rounded-xl border">
              {/* Swimlane section header */}
              <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
                {/* Assignee avatar */}
                {swimlaneGroup === 'assigned_to' && (
                  <LaneAvatar laneId={entry.id} label={entry.label} />
                )}
                {/* Priority dot */}
                {swimlaneGroup === 'priority' && (
                  <span
                    className={cn(
                      'size-2.5 shrink-0 rounded-full',
                      entry.id === 'high'
                        ? 'bg-red-500'
                        : entry.id === 'medium'
                          ? 'bg-blue-500'
                          : 'bg-gray-400'
                    )}
                  />
                )}
                {/* Status dot */}
                {swimlaneGroup === 'status' && (
                  <span
                    className={cn(
                      'size-2.5 shrink-0 rounded-full',
                      STATUS_COLORS[entry.id as keyof typeof STATUS_COLORS]?.split(' ')[0] ?? 'bg-gray-400'
                    )}
                  />
                )}
                <span className="text-sm font-semibold">{entry.label}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {entry.totalLeads}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatCurrency(entry.totalValue)}
                </span>
              </div>

              {/* Kanban columns for this swimlane section */}
              <div className="flex gap-3 overflow-x-auto p-4">
                {allEmpty ? (
                  <div className="flex w-full items-center justify-center py-8 text-center">
                    <p className="text-xs text-muted-foreground">No leads in this group</p>
                  </div>
                ) : (
                  entry.pipeline.map((stage) => {
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
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---------- Flat (non-swimlane) rendering ----------

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
              {totalLeads} leads
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

/** Small avatar used in assignee swimlane headers */
function LaneAvatar({ laneId }: { laneId: string; label: string }) {
  const user = USERS.find((u) => u.id === laneId);
  if (user) {
    return (
      <Avatar className="size-6">
        <AvatarFallback className={cn('text-[10px] text-white', user.color)}>
          {user.initials}
        </AvatarFallback>
      </Avatar>
    );
  }
  return (
    <Avatar className="size-6">
      <AvatarFallback className="text-[10px] bg-muted-foreground/20 text-muted-foreground">
        <IconUser size={12} />
      </AvatarFallback>
    </Avatar>
  );
}
