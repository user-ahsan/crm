'use client';

import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  description,
  className,
}: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold">{value}</div>
          {trend && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-sm font-medium',
                trend.isPositive ? 'text-green-600' : 'text-red-600',
              )}
            >
              {trend.isPositive ? (
                <IconTrendingUp size={16} />
              ) : (
                <IconTrendingDown size={16} />
              )}
              {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default StatCard;
