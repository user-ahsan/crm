'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Lead } from '@/types/lead.types';
import { leadService } from '@/services/lead.service';
import {
  computePipelineFunnel,
  computeLeadSources,
  computeMonthlyPerformance,
  computeDashboardKPIs,
} from '@/modules/analytics/analyticsUtils';
import { formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
  ProgressTrack,
  ProgressIndicator,
} from '@/components/ui/progress';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { StatCard } from '@/components/common/StatCard';
import { useForecasts } from '@/hooks/useForecasts';
import Link from 'next/link';
import {
  IconUsers,
  IconTrendingUp,
  IconCheck,
  IconCurrencyDollar,
  IconChartBar,
  IconSourceCode,
  IconCalendarMonth,
  IconStatusChange,
  IconTarget,
} from '@tabler/icons-react';

type PageState = 'loading' | 'error' | 'empty' | 'ready';

/* ── Inline horizontal bar that fills proportionally ────── */
function FunnelBar({ value, maxValue, label }: { value: number; maxValue: number; label: string }) {
  const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="h-8 w-full overflow-hidden rounded-md bg-muted">
      <div
        className="flex h-full items-center px-3 text-sm font-medium text-white transition-all"
        style={{
          width: `${Math.max(width, value > 0 ? 4 : 0)}%`,
          backgroundColor: 'var(--color-primary)',
        }}
      >
        {width > 15 ? label : null}
      </div>
    </div>
  );
}

/* ── Simple bar chart for monthly trends ────────────────── */
function BarChart({
  data,
  bars,
}: {
  data: { label: string; values: { key: string; value: number; color: string }[] }[];
  bars: { key: string; label: string; color: string }[];
}) {
  if (data.length === 0) return null;
  const allValues = data.flatMap((d) => d.values.map((v) => v.value));
  const maxValue = Math.max(...allValues, 1);

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {bars.map((bar) => (
          <div key={bar.key} className="flex items-center gap-1.5">
            <span
              className="inline-block size-3 rounded-sm"
              style={{ backgroundColor: bar.color }}
            />
            <span>{bar.label}</span>
          </div>
        ))}
      </div>
      {/* Chart area */}
      <div className="flex items-end gap-4" style={{ height: 220 }}>
        {data.map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-col-reverse items-center gap-0.5" style={{ height: 180 }}>
              {item.values.map((v) => (
                <div
                  key={v.key}
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${(v.value / maxValue) * 160}px`,
                    minHeight: v.value > 0 ? 4 : 0,
                    backgroundColor: v.color,
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Forecast Widget Card ──────────────────────────────── */
function ForecastCard() {
  const now = new Date();
  const qStart = Math.floor((now.getMonth()) / 3) * 3 + 1;
  const { summary, loading } = useForecasts(now.getFullYear());
  const quarterMonths = [qStart, qStart + 1, qStart + 2];
  const qForecasts = summary?.months.filter((m) => quarterMonths.includes(m.month)) ?? [];
  const qTarget = qForecasts.reduce((s, f) => s + f.target, 0);
  const qActual = qForecasts.reduce((s, f) => s + f.actual, 0);
  const qAchievement = qTarget > 0 ? Math.round((qActual / qTarget) * 100) : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconTarget size={20} className="text-muted-foreground" />
          Current Quarter Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Q{quarterMonths[0] === 1 ? 1 : quarterMonths[0] === 4 ? 2 : quarterMonths[0] === 7 ? 3 : 4} Target
          </span>
          <span className="font-medium">{formatCurrency(qTarget)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Actual</span>
          <span className="font-medium">{formatCurrency(qActual)}</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Achievement</span>
            <span className="font-medium">{qAchievement}%</span>
          </div>
          <Progress value={qAchievement}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </div>
        <Link
          href="/settings/forecasts"
          className="mt-2 inline-flex items-center text-sm font-medium text-primary hover:underline"
        >
          View full forecast &rarr;
        </Link>
      </CardContent>
    </Card>
  );
}

/* ── Analytics Page ─────────────────────────────────────── */
export default function AnalyticsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setPageState('loading');
    setError(null);
    try {
      const l = await leadService.getAll();
      setLeads(l);
      if (l.length === 0) {
        setPageState('empty');
      } else {
        setPageState('ready');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
      setPageState('error');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRetry = useCallback(() => {
    loadData();
  }, [loadData]);

  /* Memoised computations */
  const kpis = useMemo(() => computeDashboardKPIs(leads, [], []), [leads]);
  const funnel = useMemo(() => computePipelineFunnel(leads), [leads]);
  const sources = useMemo(() => computeLeadSources(leads), [leads]);
  const monthly = useMemo(() => computeMonthlyPerformance(leads), [leads]);

  /* ── Status distribution (derived) ──────────────────────── */
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    const statuses = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
    for (const s of statuses) counts[s] = 0;
    for (const lead of leads) {
      counts[lead.status] = (counts[lead.status] ?? 0) + 1;
    }
    return statuses.map((s) => ({
      status: s,
      count: counts[s],
      percentage: leads.length > 0 ? Math.round((counts[s] / leads.length) * 100) : 0,
    }));
  }, [leads]);

  const maxFunnelCount = Math.max(...funnel.map((s) => s.count), 1);
  const maxFunnelValue = Math.max(...funnel.map((s) => s.value), 1);

  const monthlyChartData = useMemo(() => {
    return monthly.map((m) => ({
      label: m.month.slice(5),
      values: [
        { key: 'leads', value: m.leads, color: 'var(--color-primary)' },
        { key: 'won', value: m.won, color: '#22c55e' },
      ],
    }));
  }, [monthly]);

  return (
    <PermissionGuard action="read" entity="analytics" fallback={<EmptyState title="Access Denied" description="You don't have permission to view analytics." />}>
      {/* ── Loading State ────────────────────────────────────── */}
      {pageState === 'loading' ? (
        <div className="space-y-6">
          <div className="space-y-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-36" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : /* ── Error State ──────────────────────────────────── */
      pageState === 'error' ? (
        <ErrorState
          title="Failed to load analytics"
          message={error ?? 'An unexpected error occurred while loading analytics data.'}
          onRetry={handleRetry}
        />
      ) : /* ── Empty State ──────────────────────────────────── */
      pageState === 'empty' ? (
        <div className="space-y-6">
          <PageHeader
            title="Analytics"
            description="Gain insights into your sales performance and pipeline metrics."
          />
          <EmptyState
            icon={<IconChartBar size={48} stroke={1.5} />}
            title="No analytics data"
            description="Add leads and manage your pipeline to see detailed analytics and performance metrics."
            action={{
              label: 'Go to Leads',
              onClick: () => {
                window.location.href = '/leads';
              },
            }}
          />
        </div>
      ) : (
        /* ── Ready State ──────────────────────────────────── */
        <div className="space-y-6">
          <PageHeader
            title="Analytics"
            description="Comprehensive insights into your sales pipeline and performance."
          />

          {/* Summary KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Leads"
              value={kpis.totalLeads}
              icon={<IconUsers size={20} />}
              description="All time"
            />
            <StatCard
              label="Active Deals"
              value={kpis.activeDeals}
              icon={<IconTrendingUp size={20} />}
              description="In pipeline"
            />
            <StatCard
              label="Won Deals"
              value={kpis.wonDeals}
              icon={<IconCheck size={20} />}
              description={`${formatCurrency(kpis.revenueEstimate)} revenue`}
            />
            <StatCard
              label="Pipeline Value"
              value={formatCurrency(kpis.pipelineValue)}
              icon={<IconCurrencyDollar size={20} />}
              description="Total estimated"
            />
          </div>

          {/* Pipeline Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconTrendingUp size={20} className="text-muted-foreground" />
                Pipeline Funnel
              </CardTitle>
            </CardHeader>
            <CardContent>
              {funnel.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No pipeline data available.
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Funnel bars by count */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Leads by Stage
                    </p>
                    {funnel.map((stage) => (
                      <div key={stage.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{stage.name}</span>
                          <span className="text-muted-foreground">{stage.count} leads</span>
                        </div>
                        <FunnelBar
                          value={stage.count}
                          maxValue={maxFunnelCount}
                          label={`${stage.count}`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Separator */}
                  <div className="border-t" />

                  {/* Funnel bars by value */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Value by Stage
                    </p>
                    {funnel.map((stage) => (
                      <div key={stage.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{stage.name}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(stage.value)}
                          </span>
                        </div>
                        <FunnelBar
                          value={stage.value}
                          maxValue={maxFunnelValue}
                          label={formatCurrency(stage.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead Sources + Status Distribution */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Lead Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconSourceCode size={20} className="text-muted-foreground" />
                  Lead Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sources.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No source data available.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {sources.map((source) => (
                      <div key={source.source} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium capitalize">{source.label}</span>
                          <span className="text-muted-foreground">
                            {source.count} ({source.percentage}%)
                          </span>
                        </div>
                        <Progress value={source.percentage}>
                          <ProgressTrack>
                            <ProgressIndicator />
                          </ProgressTrack>
                        </Progress>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconStatusChange size={20} className="text-muted-foreground" />
                  Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statusDistribution.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No status data available.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {statusDistribution.map((item) => (
                      <div key={item.status} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <StatusBadge status={item.status} />
                          <span className="text-muted-foreground">
                            {item.count} ({item.percentage}%)
                          </span>
                        </div>
                        <Progress value={item.percentage}>
                          <ProgressTrack>
                            <ProgressIndicator />
                          </ProgressTrack>
                        </Progress>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Forecast Widget */}
          <ForecastCard />

          {/* Monthly Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCalendarMonth size={20} className="text-muted-foreground" />
                Monthly Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyChartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No monthly data available yet.
                </p>
              ) : (
                <BarChart
                  data={monthlyChartData}
                  bars={[
                    { key: 'leads', label: 'Leads', color: 'var(--color-primary)' },
                    { key: 'won', label: 'Won', color: '#22c55e' },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PermissionGuard>
  );
}
