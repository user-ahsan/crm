'use client';

import type { FunnelStage, ConversionRate } from '@/modules/analytics/analyticsUtils';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconTrendingUp } from '@tabler/icons-react';

/* ── Color map matching PIPELINE_STAGES from constants ──── */
const STAGE_COLORS: Record<string, string> = {
  New: 'bg-blue-500',
  Contacted: 'bg-yellow-500',
  Qualified: 'bg-purple-500',
  Proposal: 'bg-orange-500',
  Won: 'bg-green-500',
  Lost: 'bg-red-400',
};

const STAGE_BG: Record<string, string> = {
  New: 'bg-blue-50 dark:bg-blue-950/40',
  Contacted: 'bg-yellow-50 dark:bg-yellow-950/40',
  Qualified: 'bg-purple-50 dark:bg-purple-950/40',
  Proposal: 'bg-orange-50 dark:bg-orange-950/40',
  Won: 'bg-green-50 dark:bg-green-950/40',
  Lost: 'bg-red-50 dark:bg-red-950/30',
};

interface PipelineFunnelProps {
  funnel: FunnelStage[];
  conversions: ConversionRate[];
}

export function PipelineFunnel({ funnel, conversions }: PipelineFunnelProps) {
  const maxCount = Math.max(...funnel.map((s) => s.count), 1);

  if (funnel.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconTrendingUp size={20} className="text-muted-foreground" />
            Pipeline Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No pipeline data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconTrendingUp size={20} className="text-muted-foreground" />
          Pipeline Funnel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {funnel.map((stage) => {
          const width = (stage.count / maxCount) * 100;
          const color = STAGE_COLORS[stage.name] ?? 'bg-primary';
          const bg = STAGE_BG[stage.name] ?? 'bg-muted';
          const conversion = conversions.find(
            (c) => c.fromStage === stage.name,
          );

          return (
            <div key={stage.name}>
              {/* Stage row */}
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span className={`inline-block size-2.5 rounded-full ${color}`} />
                  {stage.name}
                </span>
                <span className="text-muted-foreground">
                  {stage.count} leads &middot; {formatCurrency(stage.value)}
                </span>
              </div>

              {/* Funnel bar with rounded right end */}
              <div className="h-10 w-full overflow-hidden rounded-lg bg-muted">
                <div
                  className={`flex h-full items-center rounded-r-md px-3 text-sm font-medium text-white transition-all ${color}`}
                  style={{ width: `${Math.max(width, stage.count > 0 ? 6 : 0)}%` }}
                >
                  {width > 12 ? stage.count : null}
                </div>
              </div>

              {/* Conversion rate arrow (between stages, not after lost) */}
              {conversion && (
                <div className={`-mb-1 mt-1.5 flex items-center gap-2 rounded-md px-3 py-1 text-xs ${bg}`}>
                  <span className="text-muted-foreground">Conversion to {conversion.toStage}:</span>
                  <span className="font-semibold">{conversion.rate}%</span>
                  <div className="ml-auto h-1.5 w-20 overflow-hidden rounded-full bg-muted-foreground/20">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${conversion.rate}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default PipelineFunnel;
