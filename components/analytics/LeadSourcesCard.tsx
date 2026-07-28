'use client';

import type { SourceBreakdown } from '@/modules/analytics/analyticsUtils';
import { DonutChart } from '@/components/analytics/DonutChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconSourceCode } from '@tabler/icons-react';

const SOURCE_COLORS: Record<string, string> = {
  manual: '#6b7280',
  website: '#3b82f6',
  referral: '#8b5cf6',
  ads: '#f97316',
  social: '#14b8a6',
};

interface LeadSourcesCardProps {
  sources: SourceBreakdown[];
}

export function LeadSourcesCard({ sources }: LeadSourcesCardProps) {
  const total = sources.reduce((s, src) => s + src.count, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconSourceCode size={20} className="text-muted-foreground" />
            Lead Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No source data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const segments = sources
    .filter((s) => s.count > 0)
    .map((s) => ({
      value: s.count,
      color: SOURCE_COLORS[s.source] ?? 'hsl(var(--muted-foreground))',
      label: s.label,
    }));

  // Sort by count descending for the legend
  const sorted = [...sources].filter((s) => s.count > 0).sort((a, b) => b.count - a.count);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconSourceCode size={20} className="text-muted-foreground" />
          Lead Sources
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
            {sorted.map((src) => {
              const color = SOURCE_COLORS[src.source] ?? '#6b7280';
              return (
                <div key={src.source} className="flex items-center gap-3 text-sm">
                  <span
                    className="inline-block size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="flex-1 capitalize text-muted-foreground">{src.label}</span>
                  <span className="font-medium">{src.count}</span>
                  <span className="w-10 text-right text-xs text-muted-foreground">
                    {src.percentage}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default LeadSourcesCard;
