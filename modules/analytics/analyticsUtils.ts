import type { Lead, LeadSource } from '@/types/lead.types';
import type { Task } from '@/types/task.types';
import type { Meeting } from '@/types/meeting.types';
import { LEAD_STATUSES, LEAD_SOURCES } from '@/lib/constants';
import { getDueTodayTasks, getOverdueTasks } from '@/lib/task-utils';

export interface DashboardKPIs {
  totalLeads: number;
  activeDeals: number;
  wonDeals: number;
  lostDeals: number;
  revenueEstimate: number;
  pipelineValue: number;
  meetingsToday: number;
  tasksDueToday: number;
  overdueTasks: number;
}

export function computeDashboardKPIs(leads: Lead[], tasks: Task[], meetings: Meeting[]): DashboardKPIs {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const meetingsToday = meetings.filter((m) => {
    const mDate = new Date(m.dateTime);
    return mDate >= today && mDate < tomorrow;
  }).length;

  return {
    totalLeads: leads.length,
    activeDeals: leads.filter((l) => !['won', 'lost'].includes(l.status)).length,
    wonDeals: leads.filter((l) => l.status === 'won').length,
    lostDeals: leads.filter((l) => l.status === 'lost').length,
    revenueEstimate: leads.filter((l) => l.status === 'won').reduce((s, l) => s + l.estimatedValue, 0),
    pipelineValue: leads.filter((l) => !['won', 'lost'].includes(l.status)).reduce((s, l) => s + l.estimatedValue, 0),
    meetingsToday,
    tasksDueToday: getDueTodayTasks(tasks).length,
    overdueTasks: getOverdueTasks(tasks).length,
  };
}

export interface FunnelStage {
  name: string;
  value: number;
  count: number;
}

export function computePipelineFunnel(leads: Lead[]): FunnelStage[] {
  return LEAD_STATUSES.map((status) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    count: leads.filter((l) => l.status === status).length,
    value: leads.filter((l) => l.status === status).reduce((s, l) => s + l.estimatedValue, 0),
  }));
}

export interface SourceBreakdown {
  source: LeadSource;
  label: string;
  count: number;
  percentage: number;
}

export function computeLeadSources(leads: Lead[]): SourceBreakdown[] {
  const total = leads.length || 1;
  return LEAD_SOURCES.map((source) => {
    const count = leads.filter((l) => l.source === source).length;
    return {
      source,
      label: source.charAt(0).toUpperCase() + source.slice(1),
      count,
      percentage: Math.round((count / total) * 100),
    };
  });
}

export interface MonthlyPerformance {
  month: string;
  leads: number;
  won: number;
}

export function computeMonthlyPerformance(leads: Lead[]): MonthlyPerformance[] {
  const monthMap = new Map<string, { leads: number; won: number }>();
  for (const lead of leads) {
    const date = new Date(lead.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key) ?? { leads: 0, won: 0 };
    existing.leads++;
    if (lead.status === 'won') existing.won++;
    monthMap.set(key, existing);
  }
  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      leads: data.leads,
      won: data.won,
    }));
}

/* ── Conversion rates between adjacent funnel stages ────────── */
export interface ConversionRate {
  fromStage: string;
  toStage: string;
  rate: number; // 0–100, NaN if fromStage has 0 entries
}

export function computeConversionRates(funnel: FunnelStage[]): ConversionRate[] {
  // Stages excluding 'lost' — lost is an exit, not a transition
  const stages = funnel.filter((s) => s.name.toLowerCase() !== 'lost');
  const rates: ConversionRate[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    rates.push({
      fromStage: stages[i].name,
      toStage: stages[i + 1].name,
      rate: stages[i].count > 0 ? Math.round((stages[i + 1].count / stages[i].count) * 100) : 0,
    });
  }
  return rates;
}

/* ── Trend helper (last month vs previous month) ──────────── */
export function computeTrend(
  monthly: MonthlyPerformance[],
  fn: (m: MonthlyPerformance) => number,
): { value: number; isPositive: boolean } | undefined {
  if (monthly.length < 2) return undefined;
  const sorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month));
  const current = fn(sorted[sorted.length - 1]);
  const prev = fn(sorted[sorted.length - 2]);
  if (prev === 0) return undefined;
  const pct = Math.round(((current - prev) / prev) * 100);
  return { value: Math.abs(pct), isPositive: pct >= 0 };
}

/* ── Win Rate ───────────────────────────────────────────────── */
export function computeWinRate(leads: Lead[]): number {
  const won = leads.filter((l) => l.status === 'won').length;
  const lost = leads.filter((l) => l.status === 'lost').length;
  const total = won + lost;
  return total > 0 ? Math.round((won / total) * 100) : 0;
}
