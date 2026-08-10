'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus, IconCurrencyDollar } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Deal } from '@/types/deal.types';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { DealTable } from '@/components/deals/DealTable';
import { DealCreateForm } from '@/components/deals/DealCreateForm';
import { useDeals } from '@/hooks/useDeals';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DealsPage() {
  const { deals, stages, loading, error, refresh, deleteDeal } = useDeals();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [stageFilter, setStageFilter] = useState('__all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | undefined>(undefined);

  const filteredDeals = useMemo(() => {
    let result = deals;
    if (debouncedSearch.trim()) {
      const s = debouncedSearch.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(s) ||
          d.tags.some((t) => t.toLowerCase().includes(s)),
      );
    }
    if (stageFilter !== '__all') {
      result = result.filter((d) => d.stageId === stageFilter);
    }
    return result;
  }, [deals, debouncedSearch, stageFilter]);

  const hasActiveFilters = debouncedSearch || stageFilter !== '__all';

  const handleEdit = useCallback(
    (id: string) => {
      const deal = deals.find((d) => d.id === id);
      if (deal) {
        setEditingDeal(deal);
        setDialogOpen(true);
      }
    },
    [deals],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const deal = deals.find((d) => d.id === id);
      if (!deal) return;
      toast(`Delete "${deal.title}"?`, {
        description: 'This action cannot be undone.',
        duration: 5000,
        action: {
          label: 'Delete',
          onClick: async () => {
            const success = await deleteDeal(id);
            if (success) {
              toast.success('Deal deleted');
            } else {
              toast.error('Failed to delete deal');
            }
          },
        },
      });
    },
    [deals, deleteDeal],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) setTimeout(() => setEditingDeal(undefined), 300);
  }, []);

  const handleCreateNew = useCallback(() => {
    setEditingDeal(undefined);
    setDialogOpen(true);
  }, []);

  // handleSuccess is a no-op because the hook manages state optimistically
  const handleSuccess = useCallback(() => {}, []);

  if (loading && deals.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deals" description="Track your deal pipeline and revenue" />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  if (error && deals.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deals" />
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <PermissionGuard action="read" entity="deal" fallback={<EmptyState title="Access Denied" description="You don't have permission to view deals." />}>
      <div className="space-y-6">
        <PageHeader title="Deals" description="Track your deal pipeline and revenue">
          <Button onClick={handleCreateNew}>
            <IconPlus className="mr-2 size-4" />
            New Deal
          </Button>
        </PageHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-64"
            aria-label="Search deals"
          />
          <Select value={stageFilter} onValueChange={(v: string | null) => { if (v !== null) setStageFilter(v); }}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by stage">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All stages</SelectItem>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredDeals.length === 0 && (
          <EmptyState
            icon={<IconCurrencyDollar size={48} stroke={1.5} />}
            title="No deals found"
            description={
              hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Get started by creating your first deal.'
            }
            action={
              !hasActiveFilters
                ? { label: 'Create Deal', onClick: handleCreateNew }
                : undefined
            }
          />
        )}

        {filteredDeals.length > 0 && (
          <DealTable
            deals={filteredDeals}
            stages={stages}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onClick={(id) => router.push(`/deals/${id}`)}
          />
        )}

        <DealCreateForm
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
          onSuccess={handleSuccess}
          editDeal={editingDeal}
          stages={stages}
        />
      </div>
    </PermissionGuard>
  );
}
