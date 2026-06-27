'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { quoteService } from '@/services/quote.service';
import { useInvoices } from '@/hooks/useInvoices';
import type { Quote } from '@/types/quote.types';
import type { PaymentTerms } from '@/types/invoice.types';
import { formatCurrency } from '@/lib/formatters';
import { IconArrowLeft, IconLoader2 } from '@tabler/icons-react';

function NewInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('quoteId');
  const { createInvoice } = useInvoices();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('net-30');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!quoteId) {
      setError('No quote selected. Please select an accepted quote first.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await quoteService.getById(quoteId);
        if (!cancelled) {
          if (data) {
            setQuote(data);
            setNotes(data.notes || '');
            setDiscount(data.discount || 0);
            // Default due date 30 days from now
            const d = new Date();
            d.setDate(d.getDate() + 30);
            setDueDate(d.toISOString().split('T')[0]);
          } else {
            setError('Quote not found');
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load quote');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [quoteId]);

  const handleSubmit = useCallback(async () => {
    if (!quote) return;
    setSubmitting(true);
    try {
      const invoice = await createInvoice({
        quoteId: quote.id,
        items: quote.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        discount,
        taxRate: taxRate / 100,
        notes,
        dueDate: dueDate || undefined,
        paymentTerms,
      });
      if (invoice) {
        toast.success(`Invoice ${invoice.invoiceNumber} created from "${quote.title}"`);
        router.push(`/invoices/${invoice.id}`);
      } else {
        toast.error('Failed to create invoice');
      }
    } catch {
      toast.error('Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  }, [quote, createInvoice, discount, taxRate, notes, dueDate, paymentTerms, router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Invoice" description="Create invoice from quote" />
        <LoadingSkeleton type="detail" count={1} />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Invoice" description="Create invoice from quote" />
        <ErrorState message={error || 'Quote not found'} onRetry={() => router.push('/quotes')} />
      </div>
    );
  }

  const subtotal = quote.items.reduce((sum, i) => sum + i.total, 0);
  const afterDiscount = Math.max(0, subtotal - discount);
  const tax = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
  const total = afterDiscount + tax;

  return (
    <div className="space-y-6">
      <PageHeader title="New Invoice" description={`From quote: ${quote.title}`}>
        <Button variant="outline" size="sm" onClick={() => router.push('/quotes')}>
          <IconArrowLeft className="mr-1.5 size-4" />
          Back to Quotes
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quote Items Preview */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quote Items</CardTitle>
            </CardHeader>
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
                  {quote.items.map((item) => (
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

          <Card>
            <CardHeader>
              <CardTitle>Invoice Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Select
                    value={paymentTerms}
                    onValueChange={(v: string | null) => { if (v) setPaymentTerms(v as PaymentTerms); }}
                  >
                    <SelectTrigger id="paymentTerms">
                      <SelectValue placeholder="Select terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="net-15">Net 15</SelectItem>
                      <SelectItem value="net-30">Net 30</SelectItem>
                      <SelectItem value="net-45">Net 45</SelectItem>
                      <SelectItem value="net-60">Net 60</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount">Discount ($)</Label>
                  <Input
                    id="discount"
                    type="number"
                    min={0}
                    step={1}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Payment instructions, terms, or additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary & Submit */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">-{formatCurrency(discount)}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                Creating...
              </>
            ) : (
              `Create Invoice for ${formatCurrency(total)}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NewInvoiceFromQuotePage() {
  return (
    <Suspense fallback={<LoadingSkeleton type="detail" count={1} />}>
      <NewInvoiceContent />
    </Suspense>
  );
}
