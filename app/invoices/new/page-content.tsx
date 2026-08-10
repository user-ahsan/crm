'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
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
import { useQuotes } from '@/hooks/useQuotes';
import { useInvoices } from '@/hooks/useInvoices';
import type { Quote } from '@/types/quote.types';
import type { PaymentTerms } from '@/types/invoice.types';
import { formatCurrency } from '@/lib/formatters';
import { IconArrowLeft, IconLoader2, IconPlus, IconTrash } from '@tabler/icons-react';

function getPreviewInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${year}-${seq}`;
}

interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

function NewInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('quoteId');
  const standalone = searchParams.get('standalone') === 'true';

  // Routed through hooks per ARCHITECTURE §3 layer rules.
  const { getById: getQuoteById } = useQuotes();
  const { createInvoice } = useInvoices();

  // Shared form state
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('net-30');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quote mode state
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Standalone mode state
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lineItems, setLineItems] = useState<LineItemInput[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Init — runs once per mode
  useEffect(() => {
    if (standalone) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInvoiceNumber(getPreviewInvoiceNumber());
      setDueDate(d.toISOString().split('T')[0]);
      setLoading(false);
      return;
    }

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
        const data = await getQuoteById(quoteId);
        if (!cancelled) {
          if (!data) {
            setError('Quote not found');
          } else if (data.status !== 'accepted') {
            // Only accepted quotes can be converted to invoices (FEATURES §14
            // quote workflow). Draft/sent/rejected quotes cannot be invoiced —
            // surface the gate rather than silently creating a corrupt record.
            setError(
              `Quote is not accepted (current status: ${data.status}). Only accepted quotes can be converted to invoices.`,
            );
          } else {
            setQuote(data);
            setNotes(data.notes || '');
            setDiscount(data.discount || 0);
            const d = new Date();
            d.setDate(d.getDate() + 30);
            setDueDate(d.toISOString().split('T')[0]);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load quote');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteId, standalone, getQuoteById]);

  // Standalone: add a new line item row
  const addLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  }, []);

  // Standalone: remove a line item row (minimum 1)
  const removeLineItem = useCallback((index: number) => {
    setLineItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Standalone: update a single field on a line item
  const updateLineItem = useCallback(
    (index: number, field: keyof LineItemInput, value: string | number) => {
      setLineItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
      // Clear field-level validation on change
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[`item_${index}_${field}`];
        return next;
      });
    },
    [],
  );

  // Standalone: validate all form fields before submission
  const validateStandalone = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!invoiceNumber.trim()) {
      errors.invoiceNumber = 'Invoice number is required';
    }

    let allEmpty = true;
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (item.description.trim()) allEmpty = false;
      if (!item.description.trim()) {
        errors[`item_${i}_description`] = 'Description is required';
      }
      if (item.quantity < 1) {
        errors[`item_${i}_quantity`] = 'Must be at least 1';
      }
      if (item.unitPrice < 0) {
        errors[`item_${i}_unitPrice`] = 'Cannot be negative';
      }
    }

    if (allEmpty) {
      errors.lineItems = 'At least one line item with a description is required';
    }

    if (discount < 0) {
      errors.discount = 'Cannot be negative';
    }
    if (taxRate < 0) {
      errors.taxRate = 'Cannot be negative';
    }
    if (taxRate > 100) {
      errors.taxRate = 'Cannot exceed 100%';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [invoiceNumber, lineItems, discount, taxRate]);

  // Submit the form (both modes)
  const handleSubmit = useCallback(async () => {
    if (standalone) {
      if (!validateStandalone()) return;
      setSubmitting(true);
      try {
        const invoice = await createInvoice({
          invoiceNumber: invoiceNumber.trim(),
          items: lineItems.map((i) => ({
            description: i.description.trim(),
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          discount,
          taxRate: taxRate / 100,
          notes,
          dueDate: dueDate || undefined,
          paymentTerms,
          status: 'draft',
        });
        if (invoice) {
          toast.success(`Invoice ${invoice.invoiceNumber} created`);
          router.push(`/invoices/${invoice.id}`);
        } else {
          toast.error('Failed to create invoice');
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to create invoice');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Quote-based submission
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  }, [standalone, quote, invoiceNumber, lineItems, discount, taxRate, notes, dueDate, paymentTerms, router, validateStandalone, createInvoice]);

  // Derived totals (computed, not stored)
  const subtotal = useMemo(() => {
    if (standalone) {
      return lineItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    }
    if (!quote) return 0;
    return quote.items.reduce((sum, i) => sum + i.total, 0);
  }, [standalone, quote, lineItems]);

  const afterDiscount = Math.max(0, subtotal - discount);
  const tax = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
  const total = afterDiscount + tax;

  // --- Render states ---

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Invoice" description="Create invoice from quote" />
        <LoadingSkeleton type="detail" count={1} />
      </div>
    );
  }

  if (!standalone && (error || !quote)) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Invoice" description="Create invoice from quote" />
        <ErrorState message={error || 'Quote not found'} onRetry={() => router.push('/quotes')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Invoice"
        description={standalone ? 'Create a standalone invoice' : `From quote: ${quote?.title ?? ''}`}
      >
        <Button variant="outline" size="sm" onClick={() => router.push(standalone ? '/invoices' : '/quotes')}>
          <IconArrowLeft className="mr-1.5 size-4" />
          {standalone ? 'Back to Invoices' : 'Back to Quotes'}
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- Left column ---------- */}
        <div className="space-y-6 lg:col-span-2">
          {/* Standalone: Invoice Details card */}
          {standalone && (
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">Invoice Number</Label>
                    <Input
                      id="invoiceNumber"
                      value={invoiceNumber}
                      onChange={(e) => {
                        setInvoiceNumber(e.target.value);
                        setValidationErrors((prev) => {
                          const next = { ...prev };
                          delete next.invoiceNumber;
                          return next;
                        });
                      }}
                      className={validationErrors.invoiceNumber ? 'border-destructive' : ''}
                    />
                    {validationErrors.invoiceNumber && (
                      <p className="text-xs text-destructive">{validationErrors.invoiceNumber}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paymentTerms">Payment Terms</Label>
                    <Select
                      value={paymentTerms}
                      onValueChange={(v: string | null) => {
                        if (v) setPaymentTerms(v as PaymentTerms);
                      }}
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
              </CardContent>
            </Card>
          )}

          {/* Standalone: Line Items card / Quote mode: Quote Items preview */}
          {standalone ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                <Button variant="outline" size="sm" onClick={addLineItem}>
                  <IconPlus className="mr-1 size-4" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {validationErrors.lineItems && (
                  <p className="text-sm text-destructive">{validationErrors.lineItems}</p>
                )}

                {/* Grid header */}
                <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-1" />
                </div>

                {lineItems.map((item, idx) => {
                  const itemTotal = item.quantity * item.unitPrice;
                  const descErr = validationErrors[`item_${idx}_description`];
                  const qtyErr = validationErrors[`item_${idx}_quantity`];
                  const priceErr = validationErrors[`item_${idx}_unitPrice`];

                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5 space-y-1">
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                          className={descErr ? 'border-destructive' : ''}
                        />
                        {descErr && <p className="text-xs text-destructive">{descErr}</p>}
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantity}
                          onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))}
                          className={`text-right ${qtyErr ? 'border-destructive' : ''}`}
                        />
                        {qtyErr && <p className="text-xs text-destructive">{qtyErr}</p>}
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(idx, 'unitPrice', Number(e.target.value))}
                          className={`text-right ${priceErr ? 'border-destructive' : ''}`}
                        />
                        {priceErr && <p className="text-xs text-destructive">{priceErr}</p>}
                      </div>
                      <div className="col-span-2 pt-2 text-right text-sm font-medium tabular-nums">
                        {formatCurrency(itemTotal)}
                      </div>
                      <div className="col-span-1 flex justify-center pt-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLineItem(idx)}
                          disabled={lineItems.length <= 1}
                          aria-label="Remove item"
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {lineItems.length <= 1 && (
                  <p className="text-xs text-muted-foreground">
                    At least one line item is required.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
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
                    {quote!.items.map((item) => (
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
          )}

          {/* Shared: Invoice Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    onChange={(e) => {
                      setTaxRate(Number(e.target.value));
                      setValidationErrors((prev) => {
                        const next = { ...prev };
                        delete next.taxRate;
                        return next;
                      });
                    }}
                    className={validationErrors.taxRate ? 'border-destructive' : ''}
                  />
                  {validationErrors.taxRate && (
                    <p className="text-xs text-destructive">{validationErrors.taxRate}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount">Discount ($)</Label>
                  <Input
                    id="discount"
                    type="number"
                    min={0}
                    step={1}
                    value={discount}
                    onChange={(e) => {
                      setDiscount(Number(e.target.value));
                      setValidationErrors((prev) => {
                        const next = { ...prev };
                        delete next.discount;
                        return next;
                      });
                    }}
                    className={validationErrors.discount ? 'border-destructive' : ''}
                  />
                  {validationErrors.discount && (
                    <p className="text-xs text-destructive">{validationErrors.discount}</p>
                  )}
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

        {/* ---------- Right column — Summary ---------- */}
        <div className="space-y-6">
          <Card className="sticky top-6">
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
                  <span className="text-muted-foreground">
                    Tax ({taxRate}%)
                  </span>
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
              'Create Invoice'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<LoadingSkeleton type="detail" count={1} />}>
      <NewInvoiceContent />
    </Suspense>
  );
}
