'use client';

import { useMemo } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { usePipeline } from '@/hooks/usePipeline';
import { IconRefresh, IconColumns } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';

export default function PipelinePage() {
  const { pipeline, leads, loading, error, refresh, getStageStats } = usePipeline();

  const totalValue = useMemo(() => {
    if (!pipeline || pipeline.length === 0) return 0;
    return pipeline.reduce((sum, stage) => sum + stage.totalValue, 0);
  }, [pipeline]);

  const totalLeads = useMemo(() => {
    if (!pipeline || pipeline.length === 0) return 0;
    return pipeline.reduce((sum, stage) => sum + stage.count, 0);
  }, [pipeline]);

  const wonValue = useMemo(() => {
    if (!pipeline || pipeline.length === 0) return 0;
    const wonStage = pipeline.find((s) => s.key === 'won');
    return wonStage?.totalValue ?? 0;
  }, [pipeline]);

  // Global loading state — initial data fetch
  if (loading && leads.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
            <div className="mt-1 h-4 w-64 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
        </div>
        <LoadingSkeleton type="card" count={3} />
      </div>
    );
  }

  // Error state
  if (error && leads.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Sales Pipeline" />
        <ErrorState
          title="Failed to load pipeline"
          message={error}
          onRetry={refresh}
        />
      </div>
    );
  }

  // Empty state — no leads at all
  if (!loading && leads.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Sales Pipeline">
          <Button variant="outline" size="sm" onClick={refresh} aria-label="Refresh pipeline">
            <IconRefresh size={16} />
            Refresh
          </Button>
        </PageHeader>
        <EmptyState
          icon={<IconColumns size={48} stroke={1.5} />}
          title="No leads in pipeline"
          description="Add leads to see your sales pipeline with drag-and-drop Kanban columns"
          action={
            pipeline.length === 0
              ? { label: 'Refresh', onClick: refresh }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header with stats summary */}
      <PageHeader
        title="Sales Pipeline"
        description={
          loading
            ? undefined
            : `${totalLeads} lead${totalLeads !== 1 ? 's' : ''} · ${formatCurrency(totalValue)} total value`
        }
      >
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh pipeline">
          <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </PageHeader>

      {/* Stats summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Leads" value={totalLeads} />
          <StatCard label="Total Value" value={formatCurrency(totalValue)} variant="primary" />
          <StatCard label="Won Value" value={formatCurrency(wonValue)} variant="success" />
          <StatCard
            label="Win Rate"
            value={
              totalLeads > 0
                ? `${Math.round(((pipeline.find((s) => s.key === 'won')?.count ?? 0) / totalLeads) * 100)}%`
                : '0%'
            }
          />
        </div>
      )}

      {/* Kanban board */}
      <KanbanBoard />
    </div>
  );
}

/** Inline stat card used for the pipeline stats summary */
function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  variant?: 'default' | 'primary' | 'success';
}) {
  const colorMap: Record<string, string> = {
    default: 'bg-card text-card-foreground',
    primary: 'bg-primary/5 text-primary border-primary/20',
    success: 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[variant]}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
