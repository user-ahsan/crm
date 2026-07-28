'use client';

import { useCallback, useMemo, memo } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Lead } from '@/types/lead.types';
import type { LeadStatus } from '@/types/lead.types';
import type { SwimlaneGroup } from '@/types/swimlane.types';
import type { WorkflowEntityType } from '@/types/workflow.types';
import type { SwimlaneEntry } from '@/hooks/usePipeline';
import type { StageDefinition } from '@/modules/pipeline/pipelineUtils';
import { usePipeline } from '@/hooks/usePipeline';
import { KanbanColumn } from '@/components/pipeline/KanbanColumn';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { USERS } from '@/data/mock-users';
import { PIPELINE_STAGES } from '@/lib/constants';
import { STATUS_COLORS } from '@/lib/color-tokens';
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
  /**
   * Entity type for loading custom workflow states.
   * Defaults to 'lead' when omitted.
   * Only used when `stages` prop is not provided.
   */
  entityType?: WorkflowEntityType;
  /**
   * Override the stage definitions used to render columns.
   * When provided, the board uses these instead of loading from the workflow service
   * or falling back to PIPELINE_STAGES.
   * Each stage's `key` is matched against lead `status` for grouping.
   */
  stages?: StageDefinition[];
}

const FALLBACK_COLOR = 'border-t-gray-500';

const KanbanBoard = memo(function KanbanBoard({
  swimlaneGroup,
  swimlaneData,
  entityType = 'lead',
  stages: propStages,
}: KanbanBoardProps = {}) {
  const router = useRouter();
  const {
    pipeline,
    loading,
    error,
    refresh,
    moveLead,
    workflowStages: hookStages,
    workflowStagesLoading,
  } = usePipeline(entityType);

  // Resolve which stages to use: prop > hook > PIPELINE_STAGES
  const resolvedStages = useMemo<StageDefinition[]>(() => {
    if (propStages) return propStages;
    if (hookStages && hookStages.length > 0) return hookStages;
    return PIPELINE_STAGES;
  }, [propStages, hookStages]);

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

  const handleMoveCard = useCallback(
    (_leadId: string, currentStageKey: string, direction: 'left' | 'right') => {
      const currentIndex = resolvedStages.findIndex((s) => s.key === currentStageKey);
      if (currentIndex === -1) return;

      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= resolvedStages.length) return;

      moveLead(_leadId, resolvedStages[targetIndex].key as LeadStatus);
    },
    [moveLead, resolvedStages]
  );

  const totalLeads = pipeline.reduce((sum, s) => sum + s.count, 0);

  // ── Helper: resolve column accent ───────────────────────────────
  // Default PIPELINE_STAGES use Tailwind border classes (e.g. 'border-t-blue-500').
  // Custom workflow stages use hex colors (e.g. '#3b82f6') via inline style.
  const resolveColumnProps = useCallback((stageKey: string, stageColor: string) => {
    const defaultStage = PIPELINE_STAGES.find((s) => s.key === stageKey);
    if (defaultStage) {
      // Default stage: use the Tailwind class
      return {
        accentColor: defaultStage.color,
        style: undefined as CSSProperties | undefined,
      };
    }
    // Custom stage: use hex color as inline style, no Tailwind accent class
    return {
      accentColor: '',
      style: { borderTopColor: stageColor } as CSSProperties,
    };
  }, []);

  // ── Swimlane rendering ─────────────────────────────────────────

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
      <div className="flex flex-col gap-4">
        {swimlaneData.map((entry) => {
          const allEmpty = entry.pipeline.every((s) => s.count === 0);
          return (
            <div key={entry.id} className="rounded-xl border">
              {/* Swimlane section header */}
              <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
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
              <span className="sr-only" role="status">Use arrow keys to move cards between stages.</span>
              <div className="flex gap-3 overflow-x-auto p-3 [mask-image:linear-gradient(to_right,black_0%,black_95%,transparent_100%)]">
                {allEmpty ? (
                  <div className="flex w-full items-center justify-center py-6 text-center">
                    <p className="text-xs text-muted-foreground">No leads in this group</p>
                  </div>
                ) : (
                  entry.pipeline.map((stage) => {
                    const stageDef = resolvedStages.find((s) => s.key === stage.key);
                    const { accentColor, style } = resolveColumnProps(stage.key, stageDef?.color ?? FALLBACK_COLOR);
                    return (
                      <KanbanColumn
                        key={stage.key}
                        stage={stage}
                        accentColor={accentColor}
                        style={style}
                        onDrop={handleDrop}
                        onLeadClick={handleLeadClick}
                        onMoveCard={handleMoveCard}
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

  // ── Flat (non-swimlane) rendering ──────────────────────────────

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

  // Loading state — use resolved stages for skeleton column count
  if (loading || workflowStagesLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 overflow-x-auto pb-4">
          {(resolvedStages.length > 0 ? resolvedStages : PIPELINE_STAGES).map((stage) => (
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Kanban columns in horizontal scroll */}
      <>
        <span className="sr-only" role="status">Use arrow keys to move cards between stages.</span>
        <div className="flex gap-3 overflow-x-auto pb-2 [mask-image:linear-gradient(to_right,black_0%,black_95%,transparent_100%)]">
        {pipeline.map((stage) => {
          const stageDef = resolvedStages.find((s) => s.key === stage.key);
          const { accentColor, style } = resolveColumnProps(stage.key, stageDef?.color ?? '');
          return (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              accentColor={accentColor}
              style={style}
              onDrop={handleDrop}
              onLeadClick={handleLeadClick}
              onMoveCard={handleMoveCard}
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
      </>
    </div>
  );
});

KanbanBoard.displayName = 'KanbanBoard';
export { KanbanBoard };

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
