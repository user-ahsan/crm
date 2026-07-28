'use client';

import type { DashboardKPIs } from '@/modules/analytics/analyticsUtils';
import { formatCurrency } from '@/lib/formatters';
import { StatCard } from '@/components/common/StatCard';
import {
  IconUsers,
  IconTrendingUp,
  IconPercentage,
  IconCurrencyDollar,
  IconChecklist,
} from '@tabler/icons-react';

interface AnalyticsKPIRowProps {
  kpis: DashboardKPIs;
  winRate: number;
  leadTrend?: { value: number; isPositive: boolean };
  wonTrend?: { value: number; isPositive: boolean };
}

export function AnalyticsKPIRow({ kpis, winRate, leadTrend, wonTrend }: AnalyticsKPIRowProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard
        label="Total Leads"
        value={kpis.totalLeads}
        icon={<IconUsers size={20} />}
        trend={leadTrend}
        description="All time"
      />
      <StatCard
        label="Active Deals"
        value={kpis.activeDeals}
        icon={<IconTrendingUp size={20} />}
        trend={wonTrend}
        description="In pipeline"
      />
      <StatCard
        label="Win Rate"
        value={`${winRate}%`}
        icon={<IconPercentage size={20} />}
        description={`${kpis.wonDeals} won · ${kpis.lostDeals} lost`}
      />
      <StatCard
        label="Pipeline Value"
        value={formatCurrency(kpis.pipelineValue)}
        icon={<IconCurrencyDollar size={20} />}
        description="Total estimated"
      />
      <StatCard
        label="Tasks Due Today"
        value={kpis.tasksDueToday}
        icon={<IconChecklist size={20} />}
        description={kpis.overdueTasks > 0 ? `${kpis.overdueTasks} overdue` : 'No overdue'}
      />
    </div>
  );
}

export default AnalyticsKPIRow;
