'use client';

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { Lead } from '@/types/lead.types';
import type { Deal, DealStage } from '@/types/deal.types';
import type { SwimlaneGroup } from '@/types/swimlane.types';
import type { WorkflowEntityType } from '@/types/workflow.types';
import type { StageDefinition } from '@/modules/pipeline/pipelineUtils';
import { KanbanBoard } from './KanbanBoard';
import { DealKanbanBoard } from '@/components/deals/DealKanbanBoard';
import { KanbanColumn } from './KanbanColumn';
import { DealKanbanColumn } from '@/components/deals/DealKanbanColumn';
import { USERS } from '@/data/mock-users';
import { PIPELINE_STAGES, LEAD_PRIORITIES } from '@/lib/constants';
import { STATUS_COLORS } from '@/lib/color-tokens';
import { buildPipeline } from '@/modules/pipeline/pipelineUtils';
import { formatCurrency, formatMultiCurrencyTotals } from '@/lib/formatters';
import { getUserName } from '@/lib/user-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { IconUser, IconUsers } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface SwimlaneBoardProps {
  type: 'leads' | 'deals';
  groupBy: SwimlaneGroup;
  leads?: Lead[];
  deals?: Deal[];
  stages?: DealStage[];
  /** Custom workflow stage definitions for lead pipelines */
  leadStages?: StageDefinition[];
  /** Entity type for loading custom workflow states (defaults to 'lead') */
  entityType?: WorkflowEntityType;
  loading?: boolean;
  onLeadDrop?: (leadId: string, stageKey: string) => void;
  onDealDrop?: (dealId: string, stageId: string) => void;
  onLeadClick?: (lead: Lead) => void;
  onDealClick?: (deal: Deal) => void;
}

interface Lane {
  id: string;
  label: string;
  leads?: Lead[];
  deals?: Deal[];
}

const PRIORITY_ORDER = ['high', 'medium', 'low'] as const;

export function SwimlaneBoard({
  type,
  groupBy,
  leads,
  deals,
  stages,
  leadStages,
  entityType = 'lead',
  loading,
  onLeadDrop,
  onDealDrop,
  onLeadClick,
  onDealClick,
  }: SwimlaneBoardProps) {
  // ─── Data & State ─────────────────────────────────
  const lanes = useMemo<Lane[]>(() => {
    if (groupBy === 'none') return [];

    if (type === 'leads' && leads) {
      return buildLeadLanes(leads, groupBy);
    }

    if (type === 'deals' && deals) {
      return buildDealLanes(deals, groupBy);
    }

    return [];
  }, [leads, deals, groupBy, type]);

  // ─── Render ───────────────────────────────────────
  if (groupBy === 'none') {
    return type === 'leads' ? <KanbanBoard entityType={entityType} /> : <DealKanbanBoard />;
  }

  if (loading && (!leads || leads.length === 0) && (!deals || deals.length === 0)) {
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

  if (lanes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center">
          <IconUsers size={24} className="text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">No grouped data</h3>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {groupBy === 'assigned_to'
              ? 'No items are assigned to any user'
              : groupBy === 'priority'
                ? 'No items with priority set'
                : 'No items to display'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {lanes.map((lane) => (
        <div key={lane.id} className="rounded-xl border">
          <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
            {groupBy === 'assigned_to' && <LaneAvatar laneId={lane.id} label={lane.label} />}
            {groupBy === 'priority' && (
              <span
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  lane.id === 'high' ? 'bg-red-500' : lane.id === 'medium' ? 'bg-blue-500' : 'bg-gray-400'
                )}
              />
            )}
            {groupBy === 'status' && (
              <span
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  STATUS_COLORS[lane.id as keyof typeof STATUS_COLORS]?.split(' ')[0] ?? 'bg-gray-400',
                )}
              />
            )}
            <span className="text-sm font-semibold">{lane.label}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {type === 'leads' ? lane.leads?.length ?? 0 : lane.deals?.length ?? 0}
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              {type === 'leads'
                ? formatCurrency((lane.leads ?? []).reduce((s, l) => s + l.estimatedValue, 0))
                : formatMultiCurrencyTotals((lane.deals ?? []).map((d) => ({ value: d.value, currency: d.currency })))}
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto p-3 [mask-image:linear-gradient(to_right,black_0%,black_95%,transparent_100%)]">
            {type === 'leads' && lane.leads && onLeadDrop && onLeadClick && (
              <LeadLaneColumns leads={lane.leads} stages={leadStages} onDrop={onLeadDrop} onLeadClick={onLeadClick} />
            )}
            {type === 'deals' && lane.deals && stages && onDealDrop && onDealClick && (
              <DealLaneColumns deals={lane.deals} stages={stages} onDrop={onDealDrop} onDealClick={onDealClick} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

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

function resolveColumnAccent(stageKey: string, stageColor?: string) {
  const defaultStage = PIPELINE_STAGES.find((s) => s.key === stageKey);
  if (defaultStage) {
    return {
      accentColor: defaultStage.color,
      style: undefined as CSSProperties | undefined,
    };
  }
  return {
    accentColor: '',
    style: { borderTopColor: stageColor ?? '#9ca3af' } as CSSProperties,
  };
}

function LeadLaneColumns({
  leads,
  stages,
  onDrop,
  onLeadClick,
}: {
  leads: Lead[];
  stages?: StageDefinition[];
  onDrop: (leadId: string, stageKey: string) => void;
  onLeadClick: (lead: Lead) => void;
}) {
  const pipeline = useMemo(() => buildPipeline(leads, stages), [leads, stages]);

  if (pipeline.every((s) => s.count === 0)) {
    return (
      <div className="flex w-full items-center justify-center py-8 text-center">
        <p className="text-xs text-muted-foreground">No leads in this group</p>
      </div>
    );
  }

  return (
    <>
      {pipeline.map((stage) => {
        const stageDef = stages?.find((s) => s.key === stage.key);
        const { accentColor, style } = resolveColumnAccent(stage.key, stageDef?.color);
        return (
          <KanbanColumn
            key={stage.key}
            stage={stage}
            accentColor={accentColor}
            style={style}
            onDrop={onDrop}
            onLeadClick={onLeadClick}
          />
        );
      })}
    </>
  );
}

function DealLaneColumns({
  deals,
  stages,
  onDrop,
  onDealClick,
}: {
  deals: Deal[];
  stages: DealStage[];
  onDrop: (dealId: string, stageId: string) => void;
  onDealClick: (deal: Deal) => void;
}) {
  const pipeline = useMemo(
    () =>
      stages.map((stage) => ({
        stage,
        deals: deals.filter((d) => d.stageId === stage.id),
        totalValue: deals.filter((d) => d.stageId === stage.id).reduce((sum, d) => sum + d.value, 0),
        count: deals.filter((d) => d.stageId === stage.id).length,
      })),
    [deals, stages],
  );

  const unassignedDeals = deals.filter((d) => !d.stageId);

  return (
    <>
      {pipeline.map(({ stage, deals: stageDeals, totalValue, count }) => (
        <DealKanbanColumn
          key={stage.id}
          stage={stage}
          deals={stageDeals}
          totalValue={totalValue}
          count={count}
          onDrop={onDrop}
          onDealClick={onDealClick}
        />
      ))}
      {unassignedDeals.length > 0 && (
        <DealKanbanColumn
          stage={{
            id: 'unassigned',
            name: 'Unassigned',
            color: '#9ca3af',
            probability: 0,
            sortOrder: 999,
            createdAt: '',
          }}
          deals={unassignedDeals}
          totalValue={unassignedDeals.reduce((sum, d) => sum + d.value, 0)}
          count={unassignedDeals.length}
          onDrop={onDrop}
          onDealClick={onDealClick}
        />
      )}
      {pipeline.length === 0 && unassignedDeals.length === 0 && (
        <div className="flex w-full items-center justify-center py-8 text-center">
          <p className="text-xs text-muted-foreground">No deals in this group</p>
        </div>
      )}
    </>
  );
}

function buildLeadLanes(leads: Lead[], groupBy: SwimlaneGroup): Lane[] {
  if (groupBy === 'assigned_to') {
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
    const lanes: Lane[] = [];
    for (const [id, groupLeads] of assigneeMap) {
      lanes.push({ id, label: getUserName(id, 'Unassigned'), leads: groupLeads });
    }
    if (unassigned.length > 0) {
      lanes.push({ id: 'unassigned', label: 'Unassigned', leads: unassigned });
    }
    return lanes;
  }

  if (groupBy === 'priority') {
    const priorityMap = new Map<string, Lead[]>();
    for (const p of LEAD_PRIORITIES) priorityMap.set(p, []);
    const unset: Lead[] = [];
    for (const lead of leads) {
      const list = priorityMap.get(lead.priority);
      if (list) list.push(lead);
      else unset.push(lead);
    }
    const lanes: Lane[] = [];
    for (const p of PRIORITY_ORDER) {
      const groupLeads = priorityMap.get(p) ?? [];
      if (groupLeads.length > 0) {
        lanes.push({ id: p, label: p.charAt(0).toUpperCase() + p.slice(1), leads: groupLeads });
      }
    }
    if (unset.length > 0) {
      lanes.push({ id: 'unset', label: 'Unset', leads: unset });
    }
    return lanes;
  }

  if (groupBy === 'status') {
    return PIPELINE_STAGES.map((s) => ({
      id: s.key,
      label: s.label,
      leads: leads.filter((l) => l.status === s.key),
    }));
  }

  return [];
}

function buildDealLanes(deals: Deal[], groupBy: SwimlaneGroup): Lane[] {
  if (groupBy === 'assigned_to') {
    const assigneeMap = new Map<string, Deal[]>();
    const unassigned: Deal[] = [];
    for (const deal of deals) {
      if (deal.assignedTo) {
        const list = assigneeMap.get(deal.assignedTo);
        if (list) list.push(deal);
        else assigneeMap.set(deal.assignedTo, [deal]);
      } else {
        unassigned.push(deal);
      }
    }
    const lanes: Lane[] = [];
    for (const [id, groupDeals] of assigneeMap) {
      lanes.push({ id, label: getUserName(id, 'Unassigned'), deals: groupDeals });
    }
    if (unassigned.length > 0) {
      lanes.push({ id: 'unassigned', label: 'Unassigned', deals: unassigned });
    }
    return lanes;
  }

  if (groupBy === 'status') {
    const stageLabels: Record<string, string> = {};
    const stageMap = new Map<string, Deal[]>();
    for (const deal of deals) {
      const key = deal.stage?.id ?? deal.stageId ?? 'unassigned';
      stageLabels[key] = deal.stage?.name ?? key;
      const list = stageMap.get(key);
      if (list) list.push(deal);
      else stageMap.set(key, [deal]);
    }
    return Array.from(stageMap.entries()).map(([id, groupDeals]) => ({
      id,
      label: stageLabels[id] ?? id,
      deals: groupDeals,
    }));
  }

  return [];
}
