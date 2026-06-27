'use client';

import { useCallback, useState } from 'react';
import type { Lead } from '@/types/lead.types';
import type { PipelineStage } from '@/modules/pipeline/pipelineUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PipelineCard } from '@/components/pipeline/PipelineCard';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { IconArrowDown } from '@tabler/icons-react';

interface KanbanColumnProps {
  stage: PipelineStage;
  accentColor: string;
  onDrop: (leadId: string, stageKey: string) => void;
  onLeadClick: (lead: Lead) => void;
}

export function KanbanColumn({ stage, accentColor, onDrop, onLeadClick }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only set false if we're actually leaving the drop zone
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const leadId = e.dataTransfer.getData('text/plain');
      if (leadId) {
        onDrop(leadId, stage.key);
      }
    },
    [stage.key, onDrop]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Allow Enter/Space to trigger the column focus for accessibility
      if (e.key === 'Enter' || e.key === ' ') {
        // No default action needed, focus management handled naturally
      }
    },
    []
  );

  return (
    <Card
      className={cn(
        'flex w-72 flex-shrink-0 flex-col border-t-[3px] transition-colors duration-200',
        accentColor,
        isDragOver && 'ring-2 ring-primary/40 bg-primary/5 shadow-lg'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      aria-label={`${stage.label} column with ${stage.count} leads`}
      role="region"
    >
      {/* Column Header */}
      <CardHeader className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-sm font-semibold truncate">
              {stage.label}
            </CardTitle>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 min-w-[1.25rem] flex items-center justify-center"
            >
              {stage.count}
            </Badge>
          </div>
          <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
            {formatCurrency(stage.totalValue)}
          </span>
        </div>
      </CardHeader>

        {/* Card List */}
      <CardContent className="p-1.5 pt-0 flex-1 min-h-0 overflow-hidden">
        {stage.leads.length > 0 ? (
          <div className="h-full overflow-y-auto overscroll-contain pr-1 space-y-1.5">
            {stage.leads.map((lead) => (
              <PipelineCard
                key={lead.id}
                lead={lead}
                onClick={onLeadClick}
              />
            ))}
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-col items-center justify-center py-6 text-center',
              'transition-opacity duration-200',
              isDragOver ? 'opacity-100' : 'opacity-60'
            )}
          >
            {isDragOver ? (
              <>
                <IconArrowDown size={20} className="text-primary" />
                <span className="text-xs font-medium text-primary mt-1">Drop here</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">No leads</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
