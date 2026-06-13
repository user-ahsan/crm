'use client';

import { useState, useCallback, useMemo } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Lead, LeadStatus, LeadSource, LeadPriority } from '@/types/lead.types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LeadTable } from '@/components/leads/LeadTable';
import { LeadCreateForm } from '@/components/leads/LeadCreateForm';
import { useLeads } from '@/hooks/useLeads';
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

const ALL_STATUS = '__all_statuses';
const ALL_SOURCE = '__all_sources';
const ALL_PRIORITY = '__all_priorities';

export default function LeadsPage() {
  const { leads, loading, error, refresh, getFiltered, deleteLead } = useLeads();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUS);
  const [sourceFilter, setSourceFilter] = useState<string>(ALL_SOURCE);
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL_PRIORITY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>(undefined);

  const filters = useMemo(
    () => ({
      search,
      status: (statusFilter !== ALL_STATUS ? statusFilter : undefined) as LeadStatus | undefined,
      source: (sourceFilter !== ALL_SOURCE ? sourceFilter : undefined) as LeadSource | undefined,
      priority: (priorityFilter !== ALL_PRIORITY ? priorityFilter : undefined) as
        | LeadPriority
        | undefined,
    }),
    [search, statusFilter, sourceFilter, priorityFilter],
  );

  const filteredLeads = useMemo(() => getFiltered(filters), [getFiltered, filters]);

  const hasActiveFilters = search || statusFilter !== ALL_STATUS || sourceFilter !== ALL_SOURCE || priorityFilter !== ALL_PRIORITY;

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
        <Button onClick={handleCreateNew}>
          <IconPlus className="mr-2 size-4" />
          New Lead
        </Button>
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

      {/* Data Table */}
      {filteredLeads.length > 0 && (
        <LeadTable leads={filteredLeads} onEdit={handleEdit} onDelete={handleDelete} />
      )}

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
