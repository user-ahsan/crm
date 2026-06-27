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
  const { pipeline, leads, loading: leadsLoading, error: leadsError, refresh: refreshLeads, swimlaneData } = usePipeline();
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
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
              <div className="mt-0.5 h-3.5 w-64 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
          </div>
          <LoadingSkeleton type="card" count={3} />
        </div>
      ) : error && (activeTab === 'leads' ? leads.length === 0 : deals.length === 0) ? (
        <div className="flex flex-col gap-4">
          <PageHeader title="Sales Pipeline" />
          <ErrorState
            title="Failed to load pipeline"
            message={error}
            onRetry={refresh}
          />
        </div>
      ) : empty ? (
        <div className="flex flex-col gap-4">
          <PageHeader title="Sales Pipeline">
            <Button variant="outline" size="sm" onClick={refresh} aria-label="Refresh pipeline">
              <IconRefresh size={16} />
              Refresh
            </Button>
          </PageHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="leads" className="h-8 text-xs gap-1.5 px-3">
                <IconColumns size={14} />
                Leads
              </TabsTrigger>
              <TabsTrigger value="deals" className="h-8 text-xs gap-1.5 px-3">
                <IconCurrencyDollar size={14} />
                Deals
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
        <div className="flex flex-col gap-4">
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
            <div className="flex items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="leads" className="h-8 text-xs gap-1.5 px-3">
                  <IconColumns size={14} />
                  Leads
                </TabsTrigger>
                <TabsTrigger value="deals" className="h-8 text-xs gap-1.5 px-3">
                  <IconCurrencyDollar size={14} />
                  Deals
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Swim:</span>
                <Button
                  variant={swimlaneGroup === 'none' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => setSwimlaneGroup('none')}
                >
                  Off
                </Button>
                <Button
                  variant={swimlaneGroup === 'assigned_to' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => setSwimlaneGroup('assigned_to')}
                >
                  <IconUser size={12} />
                  User
                </Button>
                {activeTab === 'leads' && (
                  <Button
                    variant={swimlaneGroup === 'priority' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => setSwimlaneGroup('priority')}
                  >
                    <IconFlag size={12} />
                    Priority
                  </Button>
                )}
              </div>
            </div>

            <TabsContent value="leads">
              {!leadsLoading && (
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <MiniStat label="Leads" value={totalLeads} />
                  <MiniStat label="Total" value={formatCurrency(totalValue)} variant="primary" />
                  <MiniStat label="Won" value={formatCurrency(wonValue)} variant="success" />
                  <MiniStat
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

            <TabsContent value="deals">
              {!dealsLoading && (
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <MiniStat label="Deals" value={deals.length} />
                  <MiniStat label="Total" value={formatCurrency(dealTotalValue)} variant="primary" />
                  <MiniStat
                    label="Avg"
                    value={deals.length > 0 ? formatCurrency(Math.round(dealTotalValue / deals.length)) : formatCurrency(0)}
                    variant="primary"
                  />
                  <MiniStat label="Stages" value={stages.length} />
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

function MiniStat({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  variant?: 'default' | 'primary' | 'success';
}) {
  const colorMap: Record<string, string> = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    success: 'text-green-600 dark:text-green-400',
  };

  return (
    <div className="flex items-baseline gap-1.5 rounded-lg border px-2.5 py-1.5">
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${colorMap[variant]}`}>{value}</span>
    </div>
  );
}
