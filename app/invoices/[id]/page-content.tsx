'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { InvoiceDownloadButton } from '@/components/invoices/InvoiceDownloadButton';
import { invoiceService } from '@/services/invoice.service';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { IconArrowLeft, IconFileInvoice } from '@tabler/icons-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  refunded: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

function LoadingState() {
  return (
    <div className="space-y-6">
      <PageHeader title="Invoice" />
      <LoadingSkeleton type="detail" count={1} />
    </div>
  );
}

function ErrorDisplay({ error, onBack }: { error: string | null; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Invoice" />
      <ErrorState message={error || 'Invoice not found'} onRetry={onBack} />
    </div>
  );
}

function InvoiceContent({ invoice }: { invoice: import("@/types/invoice.types").Invoice }) {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <PageHeader title={'Invoice ' + invoice.invoiceNumber}>
        <Button variant="outline" size="sm" onClick={() => router.push('/invoices')}>
          <IconArrowLeft className="mr-1.5 size-4" /> Back to Invoices
        </Button>
        <InvoiceDownloadButton invoice={invoice} variant="default" />
      </PageHeader>

      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <IconFileInvoice size={24} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">Created {formatDate(invoice.createdAt)}</p>
            </div>
          </div>
          <Badge className={STATUS_COLORS[invoice.status]}>
            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Description</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Unit Price</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{item.description}</td>
                      <td className="py-3 text-right">{item.quantity}</td>
                      <td className="py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">-{formatCurrency(invoice.discount)}</span>
                </div>
              )}
              {invoice.taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(invoice.tax)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total Due</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={STATUS_COLORS[invoice.status]}>
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span>{invoice.dueDate ? formatDate(invoice.dueDate) : '-'}</span>
              </div>
              {invoice.paidAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid At</span>
                  <span>{formatDate(invoice.paidAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {invoice.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<import("@/types/invoice.types").Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const id = typeof params.id === "string" ? params.id : ""; const data = await invoiceService.getById(id);
        if (!cancelled) setInvoice(data ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load invoice');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.id]);

  if (loading) return <LoadingState />;
  if (error || !invoice) return <ErrorDisplay error={error} onBack={() => router.push('/invoices')} />;
  return <InvoiceContent invoice={invoice} />;
}



