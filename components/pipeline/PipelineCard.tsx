'use client';

import { useCallback, useRef, useState } from 'react';
import type { Lead } from '@/types/lead.types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PRIORITY_COLORS } from '@/lib/constants';
import { formatCurrency, getInitials } from '@/lib/formatters';
import { IconUser } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface PipelineCardProps {
  lead: Lead;
  onDragStart?: (lead: Lead) => void;
  onClick?: (lead: Lead) => void;
}

export function PipelineCard({ lead, onDragStart, onClick }: PipelineCardProps) {
  const dragImageRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('text/plain', lead.id);
      e.dataTransfer.effectAllowed = 'move';

      // Create a custom drag image for better UX
      if (dragImageRef.current) {
        e.dataTransfer.setDragImage(dragImageRef.current, 20, 20);
      }

      // Add a small delay to show the dragging state
      setIsDragging(true);

      onDragStart?.(lead);
    },
    [lead, onDragStart]
  );

  const handleDragEnd = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    onClick?.(lead);
  }, [lead, onClick]);

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
        isDragging && 'opacity-50 scale-[0.97] z-50 relative'
      )}
      role="button"
      tabIndex={0}
      aria-label={`Lead card for ${lead.fullName}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <CardContent className="flex flex-col gap-1 p-2.5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-1.5">
          <span className="text-sm font-medium truncate">{lead.fullName}</span>
          <Badge
            variant="outline"
            className={cn(
              'flex-shrink-0 text-[10px] px-1.5 py-0 leading-3',
              PRIORITY_COLORS[lead.priority]
            )}
          >
            {lead.priority}
          </Badge>
        </div>

        {/* Company name + value + avatar in one row */}
        <div className="flex items-center justify-between gap-1.5">
          {lead.companyName ? (
            <span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
              {lead.companyName}
            </span>
          ) : (
            <span className="text-xs font-semibold text-primary">
              {formatCurrency(lead.estimatedValue)}
            </span>
          )}

          {lead.companyName && (
            <span className="text-xs font-semibold text-primary flex-shrink-0">
              {formatCurrency(lead.estimatedValue)}
            </span>
          )}

          {/* Assigned user avatar */}
          {lead.assignedTo ? (
            <Avatar className="size-5 flex-shrink-0">
              <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-medium">
                {getInitials(
                  lead.assignedTo
                    .replace(/^user-\d+-?/, '')
                    .replace(/-/g, ' ')
                    .trim() || lead.assignedTo.slice(0, 2)
                )}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className="size-5 flex-shrink-0 opacity-40">
              <AvatarFallback>
                <IconUser size={10} />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </CardContent>

      {/* Hidden drag image reference */}
      <div
        ref={dragImageRef}
        className="fixed -top-full -left-full w-72 rounded-xl bg-card p-3 shadow-2xl ring-1 ring-foreground/10 text-sm"
        aria-hidden="true"
      >
        <div className="font-medium text-sm">{lead.fullName}</div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">{lead.companyName || 'No company'}</span>
          <span className="text-xs font-semibold text-primary">{formatCurrency(lead.estimatedValue)}</span>
        </div>
      </div>
    </Card>
  );
}
