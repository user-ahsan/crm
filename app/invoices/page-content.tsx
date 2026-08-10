'use client';

import { useState, useCallback, useMemo, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { InvoiceStatus } from '@/types/invoice.types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useInvoices } from '@/hooks/useInvoices';
import { InvoiceDownloadButton } from '@/components/invoices/InvoiceDownloadButton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconDotsVertical, IconEye, IconTrash } from '@tabler/icons-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getAllowedInvoiceStatuses } from '@/lib/constants';

const ALL_STATUS = '__all_statuses';
const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  refunded: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

function InvoicesPageContent() {
  const router = useRouter();
  const { invoices, loading, error, refresh, updateInvoiceStatus, deleteInvoice } = useInvoices();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUS);

  // Overdue detection: on load, any invoice with status='sent' AND a dueDate
  // in the past is auto-marked overdue. The service (F15) supports the
  // 'overdue' status; the hook's optimistic update shows the badge instantly
  // while the persistence runs in the background.
  useEffect(() => {
    if (invoices.length === 0) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueCandidates = invoices.filter(
      (inv) => inv.status === 'sent' && inv.dueDate && new Date(inv.dueDate) < today,
    );
    for (const inv of overdueCandidates) {
      updateInvoiceStatus(inv.id, 'overdue');
    }
  }, [invoices, updateInvoiceStatus]);

  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((inv) =>
        inv.invoiceNumber.toLowerCase().includes(s) ||
        inv.notes.toLowerCase().includes(s)
      );
    }
    if (statusFilter !== ALL_STATUS) {
      result = result.filter((inv) => inv.status === statusFilter);
    }
    return result;
  }, [invoices, search, statusFilter]);

  const hasActiveFilters = search || statusFilter !== ALL_STATUS;

  const handleStatusChange = useCallback(async (id: string, status: InvoiceStatus) => {
    try {
      const updated = await updateInvoiceStatus(id, status);
      if (updated) {
        toast.success(`Invoice status changed to ${status}`);
      } else {
        toast.error('Failed to update status');
      }
    } catch {
      toast.error('Failed to update status');
    }
  }, [updateInvoiceStatus]);

  const handleDelete = useCallback((id: string) => {
    const invoice = invoices.find((inv) => inv.id === id);
    if (!invoice) return;
    toast(`Delete ${invoice.invoiceNumber}?`, {
      description: 'This action cannot be undone.',
      duration: 5000,
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            const success = await deleteInvoice(id);
            if (success) {
              toast.success('Invoice deleted successfully');
            } else {
              toast.error('Failed to delete invoice');
            }
          } catch {
            toast.error('Failed to delete invoice');
          }
        },
      },
    });
  }, [invoices, deleteInvoice]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoices" description="Track and manage all invoices" />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoices" description="Track and manage all invoices" />
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Track and manage all invoices">
        <Button onClick={() => router.push('/invoices/new?standalone=true')}>
          <IconPlus className="mr-2 size-4" />
          New Invoice
        </Button>
        <Button variant="outline" onClick={() => router.push('/quotes')}>
          New from Quote
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search invoices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-64"
          aria-label="Search invoices"
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
            {INVOICE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredInvoices.length === 0 && (
        <EmptyState
          title="No invoices found"
          description={
            hasActiveFilters
              ? 'Try adjusting your filters to find what you are looking for.'
              : 'Convert an accepted quote to an invoice to get started.'
          }
          action={
            !hasActiveFilters
              ? { label: 'Go to Quotes', onClick: () => router.push('/quotes') }
              : undefined
          }
        />
      )}

      {filteredInvoices.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-52">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id} className="cursor-pointer" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[invoice.status]} variant="secondary">
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatCurrency(invoice.total)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(invoice.createdAt)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <InvoiceDownloadButton invoice={invoice} size="sm" showPreview />
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon" className="size-8">
                            <IconDotsVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {getAllowedInvoiceStatuses(invoice.status)
                            .filter((s) => s !== invoice.status)
                            .map((targetStatus) => (
                              <DropdownMenuItem
                                key={targetStatus}
                                onClick={() => handleStatusChange(invoice.id, targetStatus)}
                              >
                                <IconEye className="mr-2 size-4" />
                                {targetStatus === 'sent' && 'Mark as Sent'}
                                {targetStatus === 'paid' && 'Mark as Paid'}
                                {targetStatus === 'overdue' && 'Mark as Overdue'}
                                {targetStatus === 'cancelled' && 'Cancel Invoice'}
                                {targetStatus === 'refunded' && 'Mark as Refunded'}
                              </DropdownMenuItem>
                            ))}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(invoice.id)}
                          >
                            <IconTrash className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<LoadingSkeleton type="table" count={1} />}>
      <InvoicesPageContent />
    </Suspense>
  );
}
