'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/common/PageHeader';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { SwimlaneBoard } from '@/components/pipeline/SwimlaneBoard';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { usePipeline } from '@/hooks/usePipeline';
import { useDeals } from '@/hooks/useDeals';
import type { SwimlaneGroup } from '@/types/swimlane.types';
import { IconRefresh, IconColumns, IconCurrencyDollar, IconColumns3, IconUser, IconFlag } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/formatters';

export default function PipelinePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('leads');
  const [swimlaneGroup, setSwimlaneGroup] = useState<SwimlaneGroup>('none');
  const { pipeline, leads, loading: leadsLoading, error: leadsError, refresh: refreshLeads, getStageStats, moveLead, swimlaneData } = usePipeline();
  const { deals, stages, loading: dealsLoading, error: dealsError, refresh: refreshDeals, updateDeal } = useDeals();

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

  const dealTotalValue = useMemo(() => {
    return deals.reduce((sum, d) => sum + d.value, 0);
  }, [deals]);

  const loading = activeTab === 'leads' ? leadsLoading : dealsLoading;
  const error = activeTab === 'leads' ? leadsError : dealsError;
  const refresh = activeTab === 'leads' ? refreshLeads : refreshDeals;

  const empty = activeTab === 'leads'
    ? !loading && leads.length === 0
    : !loading && deals.length === 0;

  return (
    <PermissionGuard action="read" entity="lead" fallback={<EmptyState title="Access Denied" description="You don't have permission to view the pipeline." />}>
      {loading && (activeTab === 'leads' ? leads.length === 0 : deals.length === 0) ? (
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
      ) : error && (activeTab === 'leads' ? leads.length === 0 : deals.length === 0) ? (
        <div className="flex flex-col gap-6 p-6">
          <PageHeader title="Sales Pipeline" />
          <ErrorState
            title="Failed to load pipeline"
            message={error}
            onRetry={refresh}
          />
        </div>
      ) : empty ? (
        <div className="flex flex-col gap-6 p-6">
          <PageHeader title="Sales Pipeline">
            <Button variant="outline" size="sm" onClick={refresh} aria-label="Refresh pipeline">
              <IconRefresh size={16} />
              Refresh
            </Button>
          </PageHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="leads">
                <IconColumns size={16} />
                Leads Pipeline
              </TabsTrigger>
              <TabsTrigger value="deals">
                <IconCurrencyDollar size={16} />
                Deals Pipeline
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <EmptyState
            icon={activeTab === 'leads' ? <IconColumns size={48} stroke={1.5} /> : <IconCurrencyDollar size={48} stroke={1.5} />}
            title={activeTab === 'leads' ? 'No leads in pipeline' : 'No deals in pipeline'}
            description={activeTab === 'leads' ? 'Add leads to see your sales pipeline with drag-and-drop Kanban columns' : 'Add deals to see your deal revenue pipeline'}
            action={{ label: 'Refresh', onClick: refresh }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6 p-6">
          <PageHeader
            title="Sales Pipeline"
            description={
              loading
                ? undefined
                : activeTab === 'leads'
                  ? `${totalLeads} lead${totalLeads !== 1 ? 's' : ''} · ${formatCurrency(totalValue)} total value`
                  : `${deals.length} deal${deals.length !== 1 ? 's' : ''} · ${formatCurrency(dealTotalValue)} total value`
            }
          >
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh pipeline">
              <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </PageHeader>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSwimlaneGroup('none'); }}>
            <TabsList>
              <TabsTrigger value="leads">
                <IconColumns size={16} />
                Leads Pipeline
              </TabsTrigger>
              <TabsTrigger value="deals">
                <IconCurrencyDollar size={16} />
                Deals Pipeline
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center justify-end mb-3 mt-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">Swimlanes</span>
                <Button
                  variant={swimlaneGroup === 'none' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-2.5 text-xs gap-1.5"
                  onClick={() => setSwimlaneGroup('none')}
                >
                  <IconColumns3 size={14} />
                  None
                </Button>
                <Button
                  variant={swimlaneGroup === 'assigned_to' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-2.5 text-xs gap-1.5"
                  onClick={() => setSwimlaneGroup('assigned_to')}
                >
                  <IconUser size={14} />
                  Assignee
                </Button>
                {activeTab === 'leads' && (
                  <Button
                    variant={swimlaneGroup === 'priority' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 px-2.5 text-xs gap-1.5"
                    onClick={() => setSwimlaneGroup('priority')}
                  >
                    <IconFlag size={14} />
                    Priority
                  </Button>
                )}
              </div>
            </div>

            <TabsContent value="leads" className="pt-4">
              {!leadsLoading && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
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
              <KanbanBoard
                swimlaneGroup={swimlaneGroup}
                swimlaneData={swimlaneData}
              />
            </TabsContent>

            <TabsContent value="deals" className="pt-4">
              {!dealsLoading && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
                  <StatCard label="Total Deals" value={deals.length} />
                  <StatCard label="Total Value" value={formatCurrency(dealTotalValue)} variant="primary" />
                  <StatCard
                    label="Avg Deal Size"
                    value={deals.length > 0 ? formatCurrency(Math.round(dealTotalValue / deals.length)) : formatCurrency(0)}
                    variant="primary"
                  />
                  <StatCard
                    label="Stages"
                    value={stages.length}
                  />
                </div>
              )}
              <SwimlaneBoard
                type="deals"
                groupBy={swimlaneGroup}
                deals={deals}
                stages={stages}
                loading={dealsLoading}
                onDealDrop={async (dealId, stageId) => {
                  try {
                    await updateDeal(dealId, { stageId });
                    refreshDeals();
                  } catch { console.error('Failed to move deal'); }
                }}
                onDealClick={(deal) => { router.push(`/deals/${deal.id}`); }}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </PermissionGuard>
  );
}

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
