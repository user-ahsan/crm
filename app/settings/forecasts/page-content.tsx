'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { IconArrowLeft, IconArrowRight, IconCalculator, IconTarget } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from '@/components/ui/progress';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { useForecasts } from '@/hooks/useForecasts';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLeads } from '@/hooks/useLeads';
import { formatCurrency } from '@/lib/formatters';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ForecastsPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { user } = useCurrentUser();
  const { forecasts, summary, loading, error, upsert, refresh } = useForecasts(selectedYear);
  const { leads } = useLeads();

  const handlePrevYear = useCallback(() => setSelectedYear((y) => y - 1), []);
  const handleNextYear = useCallback(() => setSelectedYear((y) => y + 1), []);

  const handleCellBlur = useCallback(async (month: number, field: 'target' | 'actual', value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || !user?.id) return;
    const existing = forecasts.find((f) => f.month === month);
    await upsert({
      year: selectedYear,
      month,
      target: existing?.target ?? 0,
      actual: existing?.actual ?? 0,
      [field]: num,
    });
  }, [selectedYear, forecasts, upsert, user?.id]);

  const handleAutoCalculate = useCallback(async () => {
    if (!user?.id) return;
    toast.info('Calculating actuals from won deals...');
    const wonByMonth = new Map<number, number>();
    for (const lead of leads) {
      if (lead.status === 'won') {
        const d = new Date(lead.updatedAt);
        if (d.getFullYear() === selectedYear) {
          const m = d.getMonth() + 1;
          wonByMonth.set(m, (wonByMonth.get(m) ?? 0) + lead.estimatedValue);
        }
      }
    }
    for (const [month, actual] of wonByMonth) {
      const existing = forecasts.find((f) => f.month === month);
      await upsert({
        year: selectedYear,
        month,
        actual,
        ...(existing ? { target: existing.target } : { target: 0 }),
      });
    }
    await refresh();
    toast.success('Actuals calculated from won deals');
  }, [selectedYear, forecasts, upsert, refresh, leads, user?.id]);

  const handleSetTargets = useCallback(async () => {
    if (!user?.id) return;
    const remaining = MONTH_NAMES.map((_, i) => i + 1).filter((m) => {
      const existing = forecasts.find((f) => f.month === m);
      return !existing || existing.target === 0;
    });
    if (remaining.length === 0) {
      toast.info('All months already have targets');
      return;
    }
    const avg = forecasts.length > 0
      ? Math.round(forecasts.reduce((s, f) => s + f.target, 0) / Math.max(forecasts.filter((f) => f.target > 0).length, 1))
      : 0;
    const defaultTarget = avg || 50000;
    for (const month of remaining) {
      await upsert({ year: selectedYear, month, target: defaultTarget });
    }
    await refresh();
    toast.success(`Targets set for ${remaining.length} month(s)`);
  }, [selectedYear, forecasts, upsert, refresh, user?.id]);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const isCurrentYear = selectedYear === currentYear;

  return (
    <PermissionGuard action="read" entity="analytics" fallback={<EmptyState title="Access Denied" description="You don't have permission to view forecasts." />}>
      <div className="space-y-6">
        <PageHeader
          title="Sales Forecasting"
          description="Set monthly targets and track actual performance against your goals."
        />

        {/* Year Selector + Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevYear}>
              <IconArrowLeft size={16} />
            </Button>
            <span className="min-w-[100px] text-center text-lg font-semibold">{selectedYear}</span>
            <Button variant="outline" size="icon" onClick={handleNextYear} disabled={isCurrentYear && currentMonth === 12}>
              <IconArrowRight size={16} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAutoCalculate}>
              <IconCalculator size={16} className="mr-1.5" />
              Auto-calculate Actuals
            </Button>
            <Button variant="outline" size="sm" onClick={handleSetTargets}>
              <IconTarget size={16} className="mr-1.5" />
              Set Targets
            </Button>
          </div>
        </div>

        {/* State handling */}
        {loading ? (
          <LoadingSkeleton type="table" count={1} />
        ) : error ? (
          <ErrorState title="Failed to load forecasts" message={error} onRetry={refresh} />
        ) : forecasts.length === 0 && !loading ? (
          <EmptyState
            icon={<IconTarget size={48} stroke={1.5} />}
            title="No forecasts yet"
            description="Set monthly targets and track your sales performance."
            action={{
              label: 'Set Targets',
              onClick: handleSetTargets,
            }}
          />
        ) : (
          <>
            {/* Monthly table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Achievement</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MONTH_NAMES.map((name, idx) => {
                      const month = idx + 1;
                      const f = forecasts.find((x) => x.month === month);
                      const target = f?.target ?? 0;
                      const actual = f?.actual ?? 0;
                      const achievement = target > 0 ? Math.round((actual / target) * 100) : 0;
                      const variance = actual - target;
                      const isPast = isCurrentYear && month < currentMonth;
                      return (
                        <TableRow key={month}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              defaultValue={target || ''}
                              onBlur={(e) => handleCellBlur(month, 'target', e.target.value)}
                              className="ml-auto h-8 w-32 text-right"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              defaultValue={actual || ''}
                              onBlur={(e) => handleCellBlur(month, 'actual', e.target.value)}
                              className="ml-auto h-8 w-32 text-right"
                              placeholder={isPast ? '0' : '—'}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={achievement} className="w-24">
                                <ProgressTrack>
                                  <ProgressIndicator />
                                </ProgressTrack>
                              </Progress>
                              <span className="min-w-[3rem] text-right text-sm">{achievement}%</span>
                            </div>
                          </TableCell>
                          <TableCell className={`text-right text-sm font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Summary */}
            {summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{selectedYear} Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">Total Target</p>
                      <p className="mt-1 text-2xl font-bold">{formatCurrency(summary.totalTarget)}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">Total Actual</p>
                      <p className="mt-1 text-2xl font-bold">{formatCurrency(summary.totalActual)}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">Achievement</p>
                      <div className="mt-2 space-y-1.5">
                        <Progress value={summary.achievement}>
                          <ProgressTrack>
                            <ProgressIndicator />
                          </ProgressTrack>
                        </Progress>
                        <p className="text-lg font-bold">{summary.achievement}%</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </PermissionGuard>
  );
}
