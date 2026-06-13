'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Quote, QuoteStatus } from '@/types/quote.types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { QuoteTable } from '@/components/quotes/QuoteTable';
import { QuoteCreateDialog } from '@/components/quotes/QuoteCreateDialog';
import { useQuotes } from '@/hooks/useQuotes';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL_STATUS = '__all_statuses';
const QUOTE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected'];

function QuotesPageContent() {
  const { quotes, loading, error, refresh, createQuote, updateQuote, deleteQuote, updateStatus } = useQuotes();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | undefined>(undefined);

  const filteredQuotes = useMemo(() => {
    let result = quotes;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((q) => q.title.toLowerCase().includes(s));
    }
    if (statusFilter !== ALL_STATUS) {
      result = result.filter((q) => q.status === statusFilter);
    }
    return result;
  }, [quotes, search, statusFilter]);

  const hasActiveFilters = search || statusFilter !== ALL_STATUS;

  const handleEdit = useCallback(
    (id: string) => {
      const quote = quotes.find((q) => q.id === id);
      if (quote) {
        setEditingQuote(quote);
        setDialogOpen(true);
      }
    },
    [quotes],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const quote = quotes.find((q) => q.id === id);
      if (!quote) return;
      toast(`Delete ${quote.title}?`, {
        description: 'This action cannot be undone.',
        duration: 5000,
        action: {
          label: 'Delete',
          onClick: async () => {
            try {
              const success = await deleteQuote(id);
              if (success) {
                toast.success('Quote deleted successfully');
              } else {
                toast.error('Failed to delete quote');
              }
            } catch {
              toast.error('Failed to delete quote');
            }
          },
        },
      });
    },
    [quotes, deleteQuote],
  );

  const handleStatusChange = useCallback(
    async (id: string, status: QuoteStatus) => {
      try {
        const updated = await updateStatus(id, status);
        if (updated) {
          toast.success(`Quote status changed to ${status}`);
        } else {
          toast.error('Failed to update status');
        }
      } catch {
        toast.error('Failed to update status');
      }
    },
    [updateStatus],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setTimeout(() => setEditingQuote(undefined), 300);
    }
  }, []);

  const handleCreateNew = useCallback(() => {
    setEditingQuote(undefined);
    setDialogOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quotes" description="Manage sales quotes and proposals" />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quotes" description="Manage sales quotes and proposals" />
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Quotes" description="Manage sales quotes and proposals">
        <Button onClick={handleCreateNew}>
          <IconPlus className="mr-2 size-4" />
          New Quote
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search quotes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-64"
          aria-label="Search quotes"
        />
        <Select
          value={statusFilter}
          onValueChange={(v: string | null) => { if (v !== null) setStatusFilter(v); }}
        >
          <SelectTrigger className="sm:w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS}>All statuses</SelectItem>
            {QUOTE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredQuotes.length === 0 && (
        <EmptyState
          title="No quotes found"
          description={
            hasActiveFilters
              ? 'Try adjusting your filters to find what you are looking for.'
              : 'Get started by creating your first quote.'
          }
          action={
            !hasActiveFilters
              ? { label: 'Create Quote', onClick: handleCreateNew }
              : undefined
          }
        />
      )}

      {filteredQuotes.length > 0 && (
        <QuoteTable
          quotes={filteredQuotes}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
        />
      )}

      <QuoteCreateDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        editQuote={editingQuote}
        onCreate={createQuote}
        onUpdate={updateQuote}
      />
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={<LoadingSkeleton type="table" count={1} />}>
      <QuotesPageContent />
    </Suspense>
  );
}
