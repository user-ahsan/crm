'use client';

import { DonutChart } from '@/components/analytics/DonutChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { IconStatusChange } from '@tabler/icons-react';

const STATUS_DONUT_COLORS: Record<string, string> = {
  new: '#3b82f6',
  contacted: '#eab308',
  qualified: '#8b5cf6',
  proposal: '#f97316',
  won: '#22c55e',
  lost: '#ef4444',
};

interface StatusItem {
  status: string;
  count: number;
  percentage: number;
}

interface StatusDistributionCardProps {
  distribution: StatusItem[];
}

export function StatusDistributionCard({ distribution }: StatusDistributionCardProps) {
  const total = distribution.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconStatusChange size={20} className="text-muted-foreground" />
            Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No status data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const segments = distribution
    .filter((d) => d.count > 0)
    .map((d) => ({
      value: d.count,
      color: STATUS_DONUT_COLORS[d.status] ?? 'hsl(var(--muted-foreground))',
      label: d.status,
    }));

  // Sort by count descending for the legend
  const sorted = [...distribution].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconStatusChange size={20} className="text-muted-foreground" />
          Status Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="shrink-0">
            <DonutChart
              segments={segments}
              size={140}
              strokeWidth={24}
              centerLabel={String(total)}
              centerSubLabel="Total"
            />
          </div>
          <div className="flex w-full flex-col gap-2.5">
            {sorted.map((d) => (
              <div key={d.status} className="flex items-center gap-3 text-sm">
                <span
                  className="inline-block size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: STATUS_DONUT_COLORS[d.status] ?? '#6b7280' }}
                />
                <div className="flex-1">
                  <StatusBadge status={d.status} />
                </div>
                <span className="font-medium">{d.count}</span>
                <span className="w-10 text-right text-xs text-muted-foreground">
                  {d.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StatusDistributionCard;
