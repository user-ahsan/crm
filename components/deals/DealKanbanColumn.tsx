'use client';

import { useCallback, useState } from 'react';
import type { Deal, DealStage } from '@/types/deal.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DealPipelineCard } from '@/components/deals/DealPipelineCard';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { IconArrowDown } from '@tabler/icons-react';

interface DealKanbanColumnProps {
  stage: DealStage;
  deals: Deal[];
  totalValue: number;
  count: number;
  onDrop: (dealId: string, stageId: string) => void;
  onDealClick: (deal: Deal) => void;
}

export function DealKanbanColumn({ stage, deals, totalValue, count, onDrop, onDealClick }: DealKanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const dealId = e.dataTransfer.getData('text/plain');
      if (dealId && stage.id !== 'unassigned') {
        onDrop(dealId, stage.id);
      }
    },
    [stage.id, onDrop],
  );

  return (
    <Card
      className={cn(
        'flex w-72 flex-shrink-0 flex-col border-t-[3px] transition-colors duration-200',
        isDragOver && 'ring-2 ring-primary/40 bg-primary/5 shadow-lg',
      )}
      style={{ borderTopColor: stage.color }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label={`${stage.name} column with ${count} deals`}
      role="region"
    >
      <CardHeader className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <CardTitle className="text-sm font-semibold truncate">{stage.name}</CardTitle>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 min-w-[1.25rem] flex items-center justify-center"
            >
              {count}
            </Badge>
          </div>
          <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
            {formatCurrency(totalValue)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-2 pt-0 flex-1 min-h-0">
        {deals.length > 0 ? (
          <ScrollArea className="h-full max-h-[calc(100vh-16rem)]">
            <div className="flex flex-col gap-2 pr-2">
              {deals.map((deal) => (
                <DealPipelineCard
                  key={deal.id}
                  deal={deal}
                  stageColor={stage.color}
                  onClick={onDealClick}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-2 py-8 text-center',
              'transition-opacity duration-200',
              isDragOver ? 'opacity-100' : 'opacity-60',
            )}
          >
            {isDragOver ? (
              <>
                <IconArrowDown size={24} className="text-primary" />
                <span className="text-xs font-medium text-primary">Drop here</span>
              </>
            ) : (
              <>
                <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                  <IconArrowDown size={16} className="text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">No deals</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
