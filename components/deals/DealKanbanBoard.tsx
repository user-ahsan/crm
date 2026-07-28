'use client';

import { useCallback, useMemo, memo } from 'react';
import { toast } from 'sonner';
import type { Deal } from '@/types/deal.types';
import { useDeals } from '@/hooks/useDeals';
import { useRouter } from 'next/navigation';
import { DealKanbanColumn } from '@/components/deals/DealKanbanColumn';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { IconRefresh, IconAlertTriangle } from '@tabler/icons-react';

const DealKanbanBoard = memo(function DealKanbanBoard() {
  const { deals, stages, loading, error, refresh, updateDealStage } = useDeals();
  const router = useRouter();

  const pipeline = useMemo(() => stages.map((stage) => ({
    stage,
    deals: deals.filter((d) => d.stageId === stage.id),
    totalValue: deals.filter((d) => d.stageId === stage.id).reduce((sum, d) => sum + d.value, 0),
    count: deals.filter((d) => d.stageId === stage.id).length,
  })), [stages, deals]);

  const unassignedDeals = deals.filter((d) => !d.stageId);

  const handleDrop = useCallback(
    async (dealId: string, stageId: string) => {
      try {
        await updateDealStage(dealId, stageId);
      } catch {
        console.error('Failed to move deal');
        toast.error('Failed to move deal');
      }
    },
    [updateDealStage],
  );

  const handleDealClick = useCallback(
    (deal: Deal) => {
      router.push(`/deals/${deal.id}`);
    },
    [router],
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <IconAlertTriangle size={24} className="text-destructive" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-foreground">Failed to load deals pipeline</h3>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Deals Pipeline</h2>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {deals.length} deals
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh deals pipeline"
        >
          <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex w-72 flex-shrink-0 flex-col gap-3 rounded-2xl border border-border/50 p-3">
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
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {pipeline.map(({ stage, deals: stageDeals, totalValue, count }) => (
            <DealKanbanColumn
              key={stage.id}
              stage={stage}
              deals={stageDeals}
              totalValue={totalValue}
              count={count}
              onDrop={handleDrop}
              onDealClick={handleDealClick}
            />
          ))}

          {unassignedDeals.length > 0 && (
            <DealKanbanColumn
              stage={{ id: 'unassigned', name: 'Unassigned', color: '#9ca3af', probability: 0, sortOrder: 999, createdAt: '' }}
              deals={unassignedDeals}
              totalValue={unassignedDeals.reduce((sum, d) => sum + d.value, 0)}
              count={unassignedDeals.length}
              onDrop={handleDrop}
              onDealClick={handleDealClick}
            />
          )}

          {pipeline.length === 0 && (
            <div className="flex w-full items-center justify-center py-16">
              <div className="text-center">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  No pipeline data
                </h3>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Create deal stages and deals to see them in the pipeline
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

DealKanbanBoard.displayName = 'DealKanbanBoard';
export { DealKanbanBoard };
