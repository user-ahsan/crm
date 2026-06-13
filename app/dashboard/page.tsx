'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { leads } from '@/data/leads';
import { tasks } from '@/data/tasks';
import { meetings } from '@/data/meetings';
import {
  computeDashboardKPIs,
  computePipelineFunnel,
  computeLeadSources,
  computeMonthlyPerformance,
} from '@/modules/analytics/analyticsUtils';
import { getDueTodayTasks } from '@/modules/tasks/taskUtils';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/common/StatCard';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import {
  IconUsers,
  IconTrendingUp,
  IconCheck,
  IconCurrencyDollar,
  IconCalendar,
  IconArrowUpRight,
  IconArrowDownRight,
} from '@tabler/icons-react';

type PageState = 'loading' | 'error' | 'empty' | 'ready';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* ── Inline simple bar chart ─────────────────────────────── */
function SimpleBarChart({
  data,
  bars,
  height = 200,
}: {
  data: { label: string; value: number; color?: string }[];
  bars: { key: string; label: string; color: string }[];
  height?: number;
}) {
  if (data.length === 0) return null;
  const maxValue = Math.max(...data.map((d) => d.value)) || 1;

  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((item) => (
        <div
          key={item.label}
          className="flex flex-1 flex-col items-center gap-1.5"
        >
          <span className="text-xs font-medium tabular-nums">
            {item.value}
          </span>
          <div
            className="w-full rounded-t-md transition-all"
            style={{
              height: `${(item.value / maxValue) * 100}%`,
              backgroundColor: item.color ?? 'var(--color-primary)',
              minHeight: 4,
            }}
          />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Dashboard Page ─────────────────────────────────────── */
export default function DashboardPage() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);

  /* Simulate brief async load to show skeleton */
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        if (leads.length === 0 && tasks.length === 0 && meetings.length === 0) {
          setPageState('empty');
        } else {
          setPageState('ready');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load dashboard data');
          setPageState('error');
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const handleRetry = useCallback(() => {
    setPageState('loading');
    setError(null);
    setTimeout(() => {
      try {
        if (leads.length === 0 && tasks.length === 0 && meetings.length === 0) {
          setPageState('empty');
        } else {
          setPageState('ready');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard data');
        setPageState('error');
      }
    }, 400);
  }, []);

  /* Memoised computations */
  const kpis = useMemo(() => computeDashboardKPIs(leads, tasks, meetings), []);
  const funnel = useMemo(() => computePipelineFunnel(leads), []);
  const sources = useMemo(() => computeLeadSources(leads), []);
  const monthly = useMemo(() => computeMonthlyPerformance(leads), []);
  const dueToday = useMemo(() => getDueTodayTasks(tasks), []);

  const today = useMemo(() => formatDate(new Date()), []);

  /* ── Loading State ────────────────────────────────────── */
  if (pageState === 'loading') {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
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
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-4 shrink-0 rounded" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  /* ── Error State ──────────────────────────────────────── */
  if (pageState === 'error') {
    return (
      <ErrorState
        title="Failed to load dashboard"
        message={error ?? 'An unexpected error occurred while loading dashboard data.'}
        onRetry={handleRetry}
      />
    );
  }

  /* ── Empty State ──────────────────────────────────────── */
  if (pageState === 'empty') {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to NexusCRM
          </h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        <EmptyState
          icon={<IconUsers size={48} stroke={1.5} />}
          title="No data yet"
          description="Start by adding your first lead. Your dashboard will populate with KPIs, charts, and insights once you have data."
          action={{
            label: 'Add Lead',
            onClick: () => {
              window.location.href = '/leads';
            },
          }}
        />
      </div>
    );
  }

  /* ── Ready State ──────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total Leads"
          value={kpis.totalLeads}
          icon={<IconUsers size={20} />}
          description="All leads in system"
        />
        <StatCard
          label="Active Deals"
          value={kpis.activeDeals}
          icon={<IconTrendingUp size={20} />}
          description="Excluding won/lost"
        />
        <StatCard
          label="Won Deals"
          value={kpis.wonDeals}
          icon={<IconCheck size={20} />}
          description={`${formatCurrency(kpis.revenueEstimate)} total`}
        />
        <StatCard
          label="Pipeline Value"
          value={formatCurrency(kpis.pipelineValue)}
          icon={<IconCurrencyDollar size={20} />}
          description={`${kpis.activeDeals} active deals`}
        />
        <StatCard
          label="Meetings Today"
          value={kpis.meetingsToday}
          icon={<IconCalendar size={20} />}
        />
      </div>

      {/* Middle Section: Pipeline Funnel + Monthly Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {funnel.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No pipeline data available.
              </p>
            ) : (
              <div className="space-y-4">
                {funnel.map((stage, index) => {
                  const maxCount = Math.max(...funnel.map((s) => s.count)) || 1;
                  const barWidth = (stage.count / maxCount) * 100;
                  return (
                    <div key={stage.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{stage.name}</span>
                        <span className="text-muted-foreground">
                          {stage.count} leads &middot;{' '}
                          {formatCurrency(stage.value)}
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.max(barWidth, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {monthly.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No monthly data available.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Legend */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-sm bg-primary" />
                    <span>Leads</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-sm bg-green-500" />
                    <span>Won</span>
                  </div>
                </div>
                {/* Bars */}
                <div
                  className="flex items-end gap-3"
                  style={{ height: 180 }}
                >
                  {monthly.map((m) => {
                    const maxLead = Math.max(...monthly.map((x) => x.leads)) || 1;
                    const maxWon = Math.max(...monthly.map((x) => x.won)) || 1;
                    return (
                      <div
                        key={m.month}
                        className="flex flex-1 flex-col items-center gap-1"
                      >
                        {/* Won bar (stacked on top) */}
                        <div
                          className="w-full rounded-t-sm bg-green-500 transition-all"
                          style={{
                            height: `${(m.won / maxWon) * 120}px`,
                            minHeight: m.won > 0 ? 4 : 0,
                          }}
                        />
                        {/* Leads bar */}
                        <div
                          className="w-full rounded-sm bg-primary transition-all"
                          style={{
                            height: `${(m.leads / maxLead) * 120}px`,
                            minHeight: m.leads > 0 ? 4 : 0,
                          }}
                        />
                        <span className="mt-1 text-xs text-muted-foreground">
                          {m.month.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Lead Sources + Tasks Due Today */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lead Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No source data available.
              </p>
            ) : (
              <div className="space-y-4">
                {sources.map((source) => (
                  <div key={source.source} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">
                        {source.label}
                      </span>
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

        {/* Tasks Due Today */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks Due Today</CardTitle>
          </CardHeader>
          <CardContent>
            {dueToday.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No tasks due today. You&apos;re all caught up!
              </p>
            ) : (
              <div className="space-y-3">
                {dueToday.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={task.status === 'completed'}
                    />
                    <div className="flex-1 space-y-1">
                      <p
                        className={
                          task.status === 'completed'
                            ? 'text-sm text-muted-foreground line-through'
                            : 'text-sm font-medium'
                        }
                      >
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2">
                        {task.priority && (
                          <Badge
                            variant="outline"
                            className="text-[10px] capitalize"
                          >
                            {task.priority}
                          </Badge>
                        )}
                        {task.relatedToType && (
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {task.relatedToType}
                          </span>
                        )}
                      </div>
                    </div>
                    {task.dueDate && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(task.dueDate).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
