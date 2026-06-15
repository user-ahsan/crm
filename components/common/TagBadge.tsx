'use client';

import { Badge } from '@/components/ui/badge';
import { IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface TagBadgeProps {
  name: string;
  color?: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export function TagBadge({ name, color = '#6366f1', onRemove, size = 'sm' }: TagBadgeProps) {
  const bg = `${color}20`;
  const text = color;

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 font-normal border-0',
        size === 'sm' ? 'text-xs h-5 px-2' : 'text-sm h-6 px-2.5',
        onRemove && 'pr-1',
      )}
      style={{ backgroundColor: bg, color: text }}
    >
      <span>{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
          aria-label={`Remove tag ${name}`}
        >
          <IconX className="size-3" />
        </button>
      )}
    </Badge>
  );
}
