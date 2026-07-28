'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/formatters';
import { useForecasts } from '@/hooks/useForecasts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from '@/components/ui/progress';
import { IconTarget } from '@tabler/icons-react';
import Link from 'next/link';

export function ForecastCard() {
  const [now] = useState(() => new Date());
  const qStart = Math.floor(now.getMonth() / 3) * 3 + 1;
  const { summary, loading } = useForecasts(now.getFullYear());
  const quarterMonths = [qStart, qStart + 1, qStart + 2];
  const qForecasts = summary?.months.filter((m) => quarterMonths.includes(m.month)) ?? [];
  const qTarget = qForecasts.reduce((s, f) => s + f.target, 0);
  const qActual = qForecasts.reduce((s, f) => s + f.actual, 0);
  const qAchievement = qTarget > 0 ? Math.round((qActual / qTarget) * 100) : 0;
  const quarterNumber = qStart === 1 ? 1 : qStart === 4 ? 2 : qStart === 7 ? 3 : 4;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <IconTarget size={18} className="text-muted-foreground" />
          Q{quarterNumber} Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Target</span>
          <span className="font-medium">{formatCurrency(qTarget)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Actual</span>
          <span className="font-medium">{formatCurrency(qActual)}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Achievement</span>
            <span className="font-semibold">{qAchievement}%</span>
          </div>
          <Progress value={qAchievement}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </div>
        <Link
          href="/settings/forecasts"
          className="mt-1 inline-flex items-center text-xs font-medium text-primary hover:underline"
        >
          View full forecast &rarr;
        </Link>
      </CardContent>
    </Card>
  );
}

export default ForecastCard;
