'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Lead } from '@/types/lead.types';
import type { Task } from '@/types/task.types';
import type { Meeting } from '@/types/meeting.types';
import { leadService } from '@/services/lead.service';
import { taskService } from '@/services/task.service';
import { meetingService } from '@/services/meeting.service';
import {
  computePipelineFunnel,
  computeLeadSources,
  computeMonthlyPerformance,
  computeDashboardKPIs,
  computeConversionRates,
  computeWinRate,
  computeTrend,
} from '@/modules/analytics/analyticsUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { IconChartBar } from '@tabler/icons-react';

import { AnalyticsKPIRow } from '@/components/analytics/AnalyticsKPIRow';
import { PipelineFunnel } from '@/components/analytics/PipelineFunnel';
import { LeadSourcesCard } from '@/components/analytics/LeadSourcesCard';
import { StatusDistributionCard } from '@/components/analytics/StatusDistributionCard';
import { MonthlyTrendsChart } from '@/components/analytics/MonthlyTrendsChart';
import { ForecastCard } from '@/components/analytics/ForecastCard';

type PageState = 'loading' | 'error' | 'empty' | 'ready';

/* ── Skeleton grid used only in loading state ───────────── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {/* KPI skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
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
      {/* Funnel + Forecast skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>
      </div>
      {/* Donuts skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="flex items-center justify-center py-8">
              <Skeleton className="size-36 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Chart skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Main Analytics Page ────────────────────────────────── */
export default function AnalyticsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);

  // ─── Data ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setPageState('loading');
    setError(null);
    try {
      const [l, t, m] = await Promise.all([
        leadService.getAll(),
        taskService.getAll(),
        meetingService.getAll(),
      ]);
      setLeads(l);
      setTasks(t);
      setMeetings(m);
      setPageState(l.length === 0 && t.length === 0 && m.length === 0 ? 'empty' : 'ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
      setPageState('error');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const handleRetry = useCallback(() => {
    loadData();
  }, [loadData]);

  // ─── Computed Metrics ─────────────────────────────────
  const kpis = useMemo(() => computeDashboardKPIs(leads, tasks, meetings), [leads, tasks, meetings]);
  const funnel = useMemo(() => computePipelineFunnel(leads), [leads]);
  const conversions = useMemo(() => computeConversionRates(funnel), [funnel]);
  const sources = useMemo(() => computeLeadSources(leads), [leads]);
  const monthly = useMemo(() => computeMonthlyPerformance(leads), [leads]);
  const winRate = useMemo(() => computeWinRate(leads), [leads]);

  // Trends (month-over-month)
  const leadTrend = useMemo(() => computeTrend(monthly, (m) => m.leads), [monthly]);
  const wonTrend = useMemo(() => computeTrend(monthly, (m) => m.won), [monthly]);

  // Status distribution derived from lead statuses
  const statusDistribution = useMemo(() => {
    const statuses = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
    const counts: Record<string, number> = Object.fromEntries(statuses.map((s) => [s, 0]));
    for (const lead of leads) {
      if (counts[lead.status] !== undefined) counts[lead.status]++;
    }
    return statuses.map((status) => ({
      status,
      count: counts[status],
      percentage: leads.length > 0 ? Math.round((counts[status] / leads.length) * 100) : 0,
    }));
  }, [leads]);

  // Monthly chart data shaped for the grouped bar chart
  const monthlyChartData = useMemo(() => {
    return monthly.map((m) => ({
      label: m.month.slice(5), // "MM" from "YYYY-MM"
      groups: [
        { key: 'leads', value: m.leads, color: 'var(--color-primary, #3b82f6)', label: 'Leads' },
        { key: 'won', value: m.won, color: '#22c55e', label: 'Won' },
      ],
    }));
  }, [monthly]);

  const chartBars = useMemo(() => [
    { key: 'leads', label: 'Leads', color: 'var(--color-primary, #3b82f6)' },
    { key: 'won', label: 'Won', color: '#22c55e' },
  ], []);

  // ─── Render ───────────────────────────────────────────
  return (
    <PermissionGuard
      action="read"
      entity="analytics"
      fallback={<EmptyState title="Access Denied" description="You don't have permission to view analytics." />}
    >
      {pageState === 'loading' ? (
        <LoadingSkeleton />
      ) : pageState === 'error' ? (
        <ErrorState
          title="Failed to load analytics"
          message={error ?? 'An unexpected error occurred while loading analytics data.'}
          onRetry={handleRetry}
        />
      ) : pageState === 'empty' ? (
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
              onClick: () => router.push('/leads'),
            }}
          />
        </div>
      ) : (
        /* ── Ready State ───────────────────────────────── */
        <div className="space-y-6">
          <PageHeader
            title="Analytics"
            description="Comprehensive insights into your sales pipeline and performance."
          />

          {/* KPI row — 5 cards with trends */}
          <AnalyticsKPIRow
            kpis={kpis}
            winRate={winRate}
            leadTrend={leadTrend}
            wonTrend={wonTrend}
          />

          {/* Pipeline Funnel (2 cols) + Forecast (1 col) */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PipelineFunnel funnel={funnel} conversions={conversions} />
            </div>
            <ForecastCard />
          </div>

          {/* Lead Sources + Status Distribution (donut charts) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <LeadSourcesCard sources={sources} />
            <StatusDistributionCard distribution={statusDistribution} />
          </div>

          {/* Monthly Trends (grouped bar chart) */}
          <MonthlyTrendsChart data={monthlyChartData} bars={chartBars} />
        </div>
      )}
    </PermissionGuard>
  );
}
