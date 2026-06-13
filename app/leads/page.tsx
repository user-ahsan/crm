'use client';

import { useState, useCallback, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Lead, LeadStatus, LeadSource, LeadPriority } from '@/types/lead.types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LeadTable } from '@/components/leads/LeadTable';
import { LeadCreateForm } from '@/components/leads/LeadCreateForm';
import { TagBadge } from '@/components/common/TagBadge';
import { useLeads } from '@/hooks/useLeads';
import { useTags } from '@/hooks/useTags';
import { useAllScores } from '@/hooks/useLeadScoring';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LEAD_STATUSES, LEAD_SOURCES, LEAD_PRIORITIES } from '@/lib/constants';
import { ExportDropdown } from '@/components/common/ExportDropdown';
import { ImportDialog } from '@/components/common/ImportDialog';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { BulkActionBar } from '@/components/common/BulkActionBar';
import { ViewsDropdown } from '@/components/common/ViewsDropdown';
import { useCsvExport } from '@/hooks/useCsvExport';
import { leadService } from '@/services/lead.service';
import { tagService } from '@/services/tag.service';
import type { SavedView } from '@/types/saved-view.types';

const ALL_STATUS = '__all_statuses';
const ALL_SOURCE = '__all_sources';
const ALL_PRIORITY = '__all_priorities';

function LeadsPageContent() {
  const { leads, loading, error, refresh, getFiltered, deleteLead } = useLeads();
  const { tags, loading: tagsLoading } = useTags();
  const { scoresMap, loading: scoresLoading, batchUpdate: batchUpdateScores } = useAllScores();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? ALL_STATUS);
  const [sourceFilter, setSourceFilter] = useState<string>(searchParams.get('source') ?? ALL_SOURCE);
  const [priorityFilter, setPriorityFilter] = useState<string>(searchParams.get('priority') ?? ALL_PRIORITY);
  const [tagFilter, setTagFilter] = useState<string>(searchParams.get('tag') ?? '');
  const [minScoreFilter, setMinScoreFilter] = useState<string>(searchParams.get('minScore') ?? '');

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set('q', debouncedSearch);
    } else {
      params.delete('q');
    }
    if (statusFilter !== ALL_STATUS) {
      params.set('status', statusFilter);
    } else {
      params.delete('status');
    }
    if (sourceFilter !== ALL_SOURCE) {
      params.set('source', sourceFilter);
    } else {
      params.delete('source');
    }
    if (priorityFilter !== ALL_PRIORITY) {
      params.set('priority', priorityFilter);
    } else {
      params.delete('priority');
    }
    if (tagFilter) {
      params.set('tag', tagFilter);
    } else {
      params.delete('tag');
    }
    if (minScoreFilter) {
      params.set('minScore', minScoreFilter);
    } else {
      params.delete('minScore');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [debouncedSearch, statusFilter, sourceFilter, priorityFilter, tagFilter, minScoreFilter, pathname, router, searchParams]);

  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>(undefined);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { exportEntity, isExporting } = useCsvExport();

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      status: (statusFilter !== ALL_STATUS ? statusFilter : undefined) as LeadStatus | undefined,
      source: (sourceFilter !== ALL_SOURCE ? sourceFilter : undefined) as LeadSource | undefined,
      priority: (priorityFilter !== ALL_PRIORITY ? priorityFilter : undefined) as
        | LeadPriority
        | undefined,
    }),
    [search, statusFilter, sourceFilter, priorityFilter],
  );

  const filteredLeads = useMemo(() => {
    let result = getFiltered(filters);
    if (tagFilter) {
      result = result.filter((l) => l.tags.includes(tagFilter));
    }
    if (minScoreFilter) {
      const minScore = parseInt(minScoreFilter, 10);
      if (!isNaN(minScore)) {
        result = result.filter((l) => {
          const s = scoresMap.get(l.id);
          return s && s.score >= minScore;
        });
      }
    }
    return result;
  }, [getFiltered, filters, tagFilter, minScoreFilter, scoresMap]);

  const handleLoadView = useCallback((view: SavedView) => {
    const f = view.filters as Record<string, string>;
    setSearch(f.search ?? '');
    setStatusFilter(f.status ?? ALL_STATUS);
    setSourceFilter(f.source ?? ALL_SOURCE);
    setPriorityFilter(f.priority ?? ALL_PRIORITY);
    setTagFilter(f.tag ?? '');
    setMinScoreFilter(f.minScore ?? '');
  }, []);

  const currentViewFilters = useMemo(() => ({
    search,
    status: statusFilter !== ALL_STATUS ? statusFilter : '',
    source: sourceFilter !== ALL_SOURCE ? sourceFilter : '',
    priority: priorityFilter !== ALL_PRIORITY ? priorityFilter : '',
    tag: tagFilter,
    minScore: minScoreFilter,
  }), [search, statusFilter, sourceFilter, priorityFilter, tagFilter, minScoreFilter]);

  const hasActiveFilters = !!(search || statusFilter !== ALL_STATUS || sourceFilter !== ALL_SOURCE || priorityFilter !== ALL_PRIORITY || tagFilter || minScoreFilter);

  const handleEdit = useCallback(
    (id: string) => {
      const lead = leads.find((l) => l.id === id);
      if (lead) {
        setEditingLead(lead);
        setDialogOpen(true);
      }
    },
    [leads],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const lead = leads.find((l) => l.id === id);
      if (!lead) return;

      toast(`Delete ${lead.fullName}?`, {
        description: 'This action cannot be undone.',
        duration: 5000,
        action: {
          label: 'Delete',
          onClick: async () => {
            try {
              const success = await deleteLead(id);
              if (success) {
                toast.success('Lead deleted successfully');
              } else {
                toast.error('Failed to delete lead');
              }
            } catch {
              toast.error('Failed to delete lead');
            }
          },
        },
      });
    },
    [leads, deleteLead],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Delay clearing edit lead to avoid dialog closing animation issues
      setTimeout(() => setEditingLead(undefined), 300);
    }
  }, []);

  const handleCreateNew = useCallback(() => {
    setEditingLead(undefined);
    setDialogOpen(true);
  }, []);

  const handleSuccess = useCallback((_lead: Lead) => {
    // The hook's internal state is already updated by createLead/updateLead
  }, []);

  const handleBulkAction = useCallback(async (action: string, ids: string[], payload?: Record<string, string>) => {
    for (const id of ids) {
      switch (action) {
        case 'change_status':
          if (payload?.status) await leadService.update(id, { status: payload.status as Lead['status'] });
          break;
        case 'change_priority':
          if (payload?.priority) await leadService.update(id, { priority: payload.priority as Lead['priority'] });
          break;
        case 'assign_to':
          if (payload?.assignedTo) await leadService.update(id, { assignedTo: payload.assignedTo });
          break;
        case 'add_tag':
          if (payload?.tag) {
            const existing = leads.find((l) => l.id === id);
            if (existing && !existing.tags.includes(payload.tag)) {
              await leadService.update(id, { tags: [...existing.tags, payload.tag] });
            }
          }
          break;
        case 'delete':
          await leadService.delete(id);
          break;
      }
    }
    refresh();
  }, [refresh, leads]);

  // --- Loading State ---
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Leads" description="Manage your sales leads pipeline" />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Leads" description="Manage your sales leads pipeline" />
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader title="Leads" description="Manage your sales leads pipeline">
        <div className="flex items-center gap-2">
          <ExportDropdown
            entityTypes={[{ key: 'leads', label: 'Leads' }]}
            onExport={exportEntity}
            isExporting={isExporting}
          />
          <PermissionGuard action="create" entity="lead">
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              Import
            </Button>
          </PermissionGuard>
          <PermissionGuard action="create" entity="lead">
            <Button onClick={handleCreateNew}>
              <IconPlus className="mr-2 size-4" />
              New Lead
            </Button>
          </PermissionGuard>
        </div>
      </PageHeader>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-64"
          aria-label="Search leads"
        />
        <Select value={statusFilter} onValueChange={(v: string | null) => { if (v !== null) setStatusFilter(v); }}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS}>All statuses</SelectItem>
            {LEAD_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v: string | null) => { if (v !== null) setSourceFilter(v); }}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by source">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SOURCE}>All sources</SelectItem>
            {LEAD_SOURCES.map((source) => (
              <SelectItem key={source} value={source}>
                {source.charAt(0).toUpperCase() + source.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v: string | null) => { if (v !== null) setPriorityFilter(v); }}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by priority">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PRIORITY}>All priorities</SelectItem>
            {LEAD_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tagFilter} onValueChange={(v: string | null) => { if (v !== null) setTagFilter(v); }}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by tag">
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.name}>
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Min score"
          value={minScoreFilter}
          onChange={(e) => setMinScoreFilter(e.target.value.replace(/\D/g, '').slice(0, 3))}
          className="sm:w-28"
          type="number"
          min={0}
          max={100}
          aria-label="Minimum score filter"
        />
        <ViewsDropdown
          entityType="lead"
          currentFilters={currentViewFilters}
          onLoadView={handleLoadView}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {/* Empty State */}
      {filteredLeads.length === 0 && (
        <EmptyState
          title="No leads found"
          description={
            hasActiveFilters
              ? 'Try adjusting your filters to find what you are looking for.'
              : 'Get started by creating your first lead.'
          }
          action={
            !hasActiveFilters
              ? { label: 'Create Lead', onClick: handleCreateNew }
              : undefined
          }
        />
      )}

      {/* Bulk Action Bar */}
      {selectedLeadIds.size > 0 && (
        <BulkActionBar
          selectedIds={Array.from(selectedLeadIds)}
          entityType="lead"
          onAction={handleBulkAction}
          onClear={() => setSelectedLeadIds(new Set())}
        />
      )}

      {/* Data Table */}
      {filteredLeads.length > 0 && (
        <LeadTable
          leads={filteredLeads}
          onEdit={handleEdit}
          onDelete={handleDelete}
          selectedIds={selectedLeadIds}
          onSelectionChange={setSelectedLeadIds}
          scores={scoresMap}
        />
      )}

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        entityType="leads"
        entityLabel="Leads"
        onImportComplete={refresh}
      />

      {/* Create/Edit Dialog */}
      <LeadCreateForm
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSuccess={handleSuccess}
        editLead={editingLead}
      />
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton type="table" count={1} />}>
      <LeadsPageContent />
    </Suspense>
  );
}
