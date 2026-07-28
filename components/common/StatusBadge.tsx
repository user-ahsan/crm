'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_COLORS } from '@/lib/color-tokens';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClasses =
    STATUS_COLORS[status as keyof typeof STATUS_COLORS] ??
    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';

  return (
    <Badge
      variant="outline"
      className={cn('font-medium capitalize', colorClasses, className)}
    >
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

export default StatusBadge;
