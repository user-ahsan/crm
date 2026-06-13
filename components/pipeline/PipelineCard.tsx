'use client';

import { useCallback, useRef } from 'react';
import type { Lead } from '@/types/lead.types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PRIORITY_COLORS } from '@/lib/constants';
import { formatCurrency, getInitials } from '@/lib/formatters';
import { IconGripVertical, IconUser } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface PipelineCardProps {
  lead: Lead;
  onDragStart?: (lead: Lead) => void;
  onClick?: (lead: Lead) => void;
}

export function PipelineCard({ lead, onDragStart, onClick }: PipelineCardProps) {
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('text/plain', lead.id);
      e.dataTransfer.effectAllowed = 'move';

      // Create a custom drag image for better UX
      if (dragImageRef.current) {
        e.dataTransfer.setDragImage(dragImageRef.current, 20, 20);
      }

      // Add a small delay to show the dragging state
      const target = e.currentTarget;
      requestAnimationFrame(() => {
        target.classList.add('opacity-50', 'scale-[0.97]');
      });

      onDragStart?.(lead);
    },
    [lead, onDragStart]
  );

  const handleDragEnd = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    target.classList.remove('opacity-50', 'scale-[0.97]');
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
        'active:shadow-sm'
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
      <CardContent className="flex flex-col gap-2 p-3">
        {/* Drag handle + Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              aria-hidden="true"
            >
              <IconGripVertical size={16} />
            </span>
            <span className="font-medium text-sm truncate">{lead.fullName}</span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'flex-shrink-0 text-[10px] px-1.5 py-0',
              PRIORITY_COLORS[lead.priority]
            )}
          >
            {lead.priority}
          </Badge>
        </div>

        {/* Company name */}
        {lead.companyName && (
          <span className="text-xs text-muted-foreground truncate pl-6">
            {lead.companyName}
          </span>
        )}

        {/* Bottom row: value + avatar */}
        <div className="flex items-center justify-between gap-2 pl-6">
          <span className="text-sm font-semibold text-primary">
            {formatCurrency(lead.estimatedValue)}
          </span>

          {/* Assigned user avatar with initials */}
          {lead.assignedTo ? (
            <Avatar size="sm" className="flex-shrink-0">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                {getInitials(
                  lead.assignedTo
                    // Parse user name from assignedTo ID — show first 2 chars as fallback
                    .replace(/^user-\d+-?/, '')
                    .replace(/-/g, ' ')
                    .trim() || lead.assignedTo.slice(0, 2)
                )}
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

      {/* Hidden drag image reference */}
      <div
        ref={dragImageRef}
        className="fixed -top-full -left-full w-64 rounded-2xl bg-card p-4 shadow-2xl ring-1 ring-foreground/10 text-sm"
        aria-hidden="true"
      >
        <div className="font-medium">{lead.fullName}</div>
        {lead.companyName && (
          <div className="text-muted-foreground text-xs">{lead.companyName}</div>
        )}
        <div className="text-primary font-semibold mt-1">
          {formatCurrency(lead.estimatedValue)}
        </div>
      </div>
    </Card>
  );
}
