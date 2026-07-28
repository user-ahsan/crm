'use client';

import { useCallback, useRef } from 'react';
import type { Deal } from '@/types/deal.types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { USERS } from '@/data/mock-users';
import { formatCurrency, getInitials } from '@/lib/formatters';
import { IconGripVertical, IconUser } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface DealPipelineCardProps {
  deal: Deal;
  stageColor?: string;
  onClick?: (deal: Deal) => void;
}

export function DealPipelineCard({ deal, onClick }: DealPipelineCardProps) {
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('text/plain', deal.id);
      e.dataTransfer.effectAllowed = 'move';
      if (dragImageRef.current) {
        e.dataTransfer.setDragImage(dragImageRef.current, 20, 20);
      }
      const target = e.currentTarget;
      requestAnimationFrame(() => {
        target.classList.add('opacity-50', 'scale-[0.97]');
      });
    },
    [deal.id],
  );

  const handleDragEnd = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    target.classList.remove('opacity-50', 'scale-[0.97]');
  }, []);

  const handleClick = useCallback(() => {
    onClick?.(deal);
  }, [deal, onClick]);

  const assignedUser = deal.assignedTo ? USERS.find((u) => u.id === deal.assignedTo) : undefined;

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      size="sm"
      className={cn(
        'cursor-grab active:cursor-grabbing transition-all duration-200 select-none',
        'hover:shadow-lg hover:ring-2 hover:ring-primary/20',
        'active:shadow-sm',
      )}
      role="button"
      tabIndex={0}
      aria-label={`Deal card for ${deal.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors" aria-hidden="true">
              <IconGripVertical size={16} />
            </span>
            <span className="font-medium text-sm truncate">{deal.title}</span>
          </div>
        </div>

        {deal.description && (
          <span className="text-xs text-muted-foreground truncate pl-6">
            {deal.description}
          </span>
        )}

        <div className="flex items-center justify-between gap-2 pl-6">
          <span className="text-sm font-semibold text-primary">
            {formatCurrency(deal.value)}
          </span>

          {assignedUser ? (
            <Avatar size="sm" className="flex-shrink-0">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                {getInitials(assignedUser.name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Avatar size="sm" className="flex-shrink-0 opacity-40">
              <AvatarFallback>
                <IconUser size={12} />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </CardContent>

      <div
        ref={dragImageRef}
        className="fixed -top-full -left-full w-64 rounded-2xl bg-card p-4 shadow-2xl ring-1 ring-foreground/10 text-sm"
        aria-hidden="true"
      >
        <div className="font-medium">{deal.title}</div>
        <div className="text-primary font-semibold mt-1">{formatCurrency(deal.value)}</div>
      </div>
    </Card>
  );
}
