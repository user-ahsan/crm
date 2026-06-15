'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Lead } from '@/types/lead.types';
import type { Task } from '@/types/task.types';
import type { Meeting } from '@/types/meeting.types';
import { useLeads } from '@/hooks/useLeads';
import { useTasks } from '@/hooks/useTasks';
import { useMeetings } from '@/hooks/useMeetings';
import { useInView } from '@/hooks/useInView';
import {
  computeDashboardKPIs,
  computePipelineFunnel,
  computeLeadSources,

  type DashboardKPIs,
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

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/common/StatCard';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { useTeamContext } from '@/context/TeamContext';
import {
  IconUsers,
  IconTrendingUp,
  IconCheck,
  IconCurrencyDollar,
  IconCalendar,
  IconArrowUpRight,
  IconArrowDownRight,
  IconArrowRight,
  IconUsersGroup,
  IconMail,
  IconStar,
  IconPlus,
  IconCalendarEvent,
  IconFileReport,
  IconChartBar,
  IconSettings,
  IconBuilding,
  IconTags,
  IconFlag,
  IconTarget,
  IconBrandTelegram,
  IconPhone,
  IconFileDescription,
  IconLink,
  IconColumns3,
} from '@tabler/icons-react';

/* ── SessionStorage cache for above-fold KPIs ──────────── */
const CACHE_KEY = 'dashboard-kpis';
const CACHE_TTL = 60_000; // 60 seconds

interface CacheEntry {
  kpis: DashboardKPIs;
  timestamp: number;
}

function loadCachedKPIs(): DashboardKPIs | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.kpis;
  } catch {
    return null;
  }
}

function saveCachedKPIs(kpis: DashboardKPIs): void {
  try {
    const entry: CacheEntry = { kpis, timestamp: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // sessionStorage may be full or unavailable — non-critical
  }
}

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
  const router = useRouter();
  const { leads, loading: leadsLoading, error: leadsError, refresh: refreshLeads } = useLeads();
  const { tasks, loading: tasksLoading, error: tasksError, refresh: refreshTasks, toggleTask } = useTasks();
  const { meetings, loading: meetingsLoading, error: meetingsError, refresh: refreshMeetings } = useMeetings();
  const { team, loading: teamLoading } = useTeamContext();

  // ── SessionStorage cache for above-fold KPIs ────────────────
  const [cachedKpis, setCachedKpis] = useState<DashboardKPIs | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setCachedKpis(loadCachedKPIs());
    setCacheReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // ── Lazy loading refs for below-fold content ──────────
  const [funnelRef, funnelInView] = useInView(0.1);

  // ── Page state (cache-aware: skip loading if cached) ──
  const pageState = useMemo<PageState>(() => {
    if (!cacheReady) return 'loading';
    if (cachedKpis) return 'ready'; // show cached data instantly
    if (leadsLoading || tasksLoading || meetingsLoading) return 'loading';
    if (leadsError || tasksError || meetingsError) return 'error';
    if (leads.length === 0 && tasks.length === 0 && meetings.length === 0) return 'empty';
    return 'ready';
  }, [cacheReady, cachedKpis, leadsLoading, tasksLoading, meetingsLoading, leadsError, tasksError, meetingsError, leads, tasks, meetings]);

  const error = leadsError ?? tasksError ?? meetingsError;

  const handleRetry = useCallback(() => {
    refreshLeads();
    refreshTasks();
    refreshMeetings();
  }, [refreshLeads, refreshTasks, refreshMeetings]);

  const handleToggleTask = useCallback(async (id: string) => {
    await toggleTask(id);
  }, [toggleTask]);

  /* Memoised computations */
  const rawKpis = useMemo(() => computeDashboardKPIs(leads, tasks, meetings), [leads, tasks, meetings]);

  // Use cached KPIs while hooks are loading or data is empty; fall through to fresh data otherwise
  const kpis = cachedKpis && (leadsLoading || tasksLoading || meetingsLoading || leads.length === 0)
    ? cachedKpis
    : rawKpis;

  // Persist fresh KPIs to cache once data arrives
  useEffect(() => {
    if (leads.length > 0 && !leadsLoading && !tasksLoading && !meetingsLoading) {
      saveCachedKPIs(rawKpis);
    }
  }, [rawKpis, leads.length, leadsLoading, tasksLoading, meetingsLoading]);
  const funnel = useMemo(() => computePipelineFunnel(leads), [leads]);
  const sources = useMemo(() => computeLeadSources(leads), [leads]);
  const dueToday = useMemo(() => getDueTodayTasks(tasks), [tasks]);

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
              router.push('/leads');
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

      {/* Team Status Banner */}
      {!teamLoading && !team && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <IconUsersGroup size={24} className="text-amber-600 dark:text-amber-400" stroke={1.5} />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No team set up yet</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Create a team to collaborate with members and manage permissions.</p>
              </div>
            </div>
            <Link href="/settings/team">
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30">
                Create Team
                <IconArrowRight size={14} />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

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

      {/* Middle Section: Pipeline Funnel + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-5 items-start">
        {/* Pipeline Funnel */}
        <div ref={funnelRef} className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {funnelInView ? (
                funnel.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No pipeline data available.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {funnel.map((stage) => {
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
                )
              ) : (
                <div className="space-y-4" style={{ minHeight: 250 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions — scrollable with max height */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[420px] overflow-y-auto">
              <nav className="divide-y divide-border">
                {[
                  { icon: IconMail, label: 'Email Campaign', desc: 'Create & send new campaign', href: '/campaigns?action=create', color: 'text-blue-500' },
                  { icon: IconStar, label: 'High Priority', desc: 'View high-priority leads', href: '/leads?priority=high', color: 'text-red-500' },
                  { icon: IconPlus, label: 'New Lead', desc: 'Add a new lead record', href: '/leads?action=create', color: 'text-emerald-500' },
                  { icon: IconUsers, label: 'New Contact', desc: 'Add a new contact', href: '/contacts?action=create', color: 'text-violet-500' },
                  { icon: IconCalendarEvent, label: 'Schedule Meeting', desc: 'Set up a meeting', href: '/meetings?action=create', color: 'text-orange-500' },
                  { icon: IconCheck, label: 'New Task', desc: 'Create a to-do item', href: '/tasks?action=create', color: 'text-cyan-500' },
                  { icon: IconCurrencyDollar, label: 'New Deal', desc: 'Track a new deal', href: '/deals?action=create', color: 'text-amber-500' },
                  { icon: IconColumns3, label: 'Pipeline', desc: 'View pipeline stages', href: '/pipeline', color: 'text-indigo-500' },
                  { icon: IconChartBar, label: 'Analytics', desc: 'View reports & charts', href: '/analytics', color: 'text-pink-500' },
                  { icon: IconFlag, label: 'Goals', desc: 'Track your targets', href: '/goals', color: 'text-rose-500' },
                  { icon: IconTarget, label: 'Quotes', desc: 'Manage quotes', href: '/quotes', color: 'text-teal-500' },
                  { icon: IconBuilding, label: 'Companies', desc: 'Browse organizations', href: '/companies', color: 'text-sky-500' },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50"
                    >
                      <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted ${action.color}`}>
                        <Icon className="size-3.5" stroke={1.5} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{action.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{action.desc}</p>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>
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
                {sources.map((source) => {
                  const maxPct = Math.max(...sources.map((s) => s.percentage)) || 1;
                  const barWidth = (source.percentage / maxPct) * 100;
                  return (
                    <div key={source.source} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">
                          {source.label}
                        </span>
                        <span className="text-muted-foreground">
                          {source.count} ({source.percentage}%)
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
                      onCheckedChange={() => handleToggleTask(task.id)}
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
