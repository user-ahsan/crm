'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InvoiceDownloadButton } from '@/components/invoices/InvoiceDownloadButton';
import { useInvoices } from '@/hooks/useInvoices';
import { useInvoiceTemplates } from '@/hooks/useInvoiceTemplates';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getAllowedInvoiceStatuses } from '@/lib/constants';
import { toast } from 'sonner';
import {
  IconArrowLeft,
  IconFileInvoice,
  IconEdit,
  IconDeviceFloppy,
  IconX,
  IconTrash,
  IconPlus,
  IconLoader2,
} from '@tabler/icons-react';
import type { InvoiceStatus, PaymentTerms } from '@/types/invoice.types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  refunded: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

const PAYMENT_TERMS_OPTIONS: { value: PaymentTerms; label: string }[] = [
  { value: 'net-15', label: 'Net 15' },
  { value: 'net-30', label: 'Net 30' },
  { value: 'net-45', label: 'Net 45' },
  { value: 'net-60', label: 'Net 60' },
];

interface EditableItem {
  tempId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface EditableInvoiceData {
  invoiceNumber: string;
  status: InvoiceStatus;
  dueDate: string;
  paymentTerms: PaymentTerms | '';
  notes: string;
  discount: number;
  taxRate: number;
  items: EditableItem[];
}

function generateTempId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function invoiceToEditable(invoice: import('@/types/invoice.types').Invoice): EditableInvoiceData {
  return {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    dueDate: invoice.dueDate ?? '',
    paymentTerms: invoice.paymentTerms ?? '',
    notes: invoice.notes ?? '',
    discount: invoice.discount,
    taxRate: Math.round(invoice.taxRate * 100 * 10) / 10, // convert decimal → percentage (e.g., 0.1 → 10)
    items: invoice.items.map((item) => ({
      tempId: generateTempId(),
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}

function computeItemTotal(qty: number, price: number): number {
  return qty * price;
}

function computeInvoiceTotals(
  items: EditableItem[],
  discount: number,
  taxRatePercent: number,
) {
  const subtotal = items.reduce((sum, item) => sum + computeItemTotal(item.quantity, item.unitPrice), 0);
  const taxRateDecimal = Math.max(0, taxRatePercent) / 100;
  const afterDiscount = Math.max(0, subtotal - Math.max(0, discount));
  const tax = Math.round(afterDiscount * taxRateDecimal * 100) / 100;
  const total = afterDiscount + tax;
  return { subtotal, tax, total };
}

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

function InvoiceContent({
  invoice,
  onUpdate,
}: {
  invoice: import('@/types/invoice.types').Invoice;
  onUpdate: (updated: import('@/types/invoice.types').Invoice) => void;
}) {
  const router = useRouter();
  const { updateInvoice, updateInvoiceStatus } = useInvoices();
  const { getDefault: getDefaultTemplate } = useInvoiceTemplates();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<EditableInvoiceData>(() => invoiceToEditable(invoice));

  const allowedStatuses = getAllowedInvoiceStatuses(invoice.status);

  // Auto-mark overdue: if invoice is 'sent' AND past due date, flip to
  // 'overdue' on load so the badge reflects the billing state.
  useEffect(() => {
    if (invoice.status === 'sent' && invoice.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(invoice.dueDate) < today) {
        updateInvoiceStatus(invoice.id, 'overdue').then((updated) => {
          if (updated) onUpdate(updated);
        });
      }
    }
  }, [invoice.id, invoice.status, invoice.dueDate, updateInvoiceStatus, onUpdate]);

  const handleEdit = useCallback(() => {
    setFormData(invoiceToEditable(invoice));
    setIsEditing(true);
  }, [invoice]);

  const handleCancel = useCallback(() => {
    setFormData(invoiceToEditable(invoice));
    setIsEditing(false);
  }, [invoice]);

  const handleFieldChange = useCallback(<K extends keyof EditableInvoiceData>(
    key: K,
    value: EditableInvoiceData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleItemChange = useCallback((tempId: string, key: 'description' | 'quantity' | 'unitPrice', value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.tempId === tempId ? { ...item, [key]: value } : item,
      ),
    }));
  }, []);

  const handleAddItem = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { tempId: generateTempId(), description: '', quantity: 1, unitPrice: 0 },
      ],
    }));
  }, []);

  const handleRemoveItem = useCallback((tempId: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.tempId !== tempId),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const safeDiscount = Math.max(0, formData.discount);
      const safeTaxRateDecimal = Math.max(0, formData.taxRate) / 100;

      // Validate items
      const emptyItems = formData.items.filter((item) => !item.description.trim());
      if (emptyItems.length > 0) {
        toast.error('All line items must have a description');
        setIsSaving(false);
        return;
      }

      // Validate negative values
      const negativeQty = formData.items.find((item) => item.quantity < 0);
      if (negativeQty) {
        toast.error(`Negative quantity not allowed: ${negativeQty.description}`);
        setIsSaving(false);
        return;
      }
      const negativePrice = formData.items.find((item) => item.unitPrice < 0);
      if (negativePrice) {
        toast.error(`Negative unit price not allowed: ${negativePrice.description}`);
        setIsSaving(false);
        return;
      }

      const updated = await updateInvoice(invoice.id, {
        invoiceNumber: formData.invoiceNumber || undefined,
        status: formData.status,
        dueDate: formData.dueDate || undefined,
        paymentTerms: (formData.paymentTerms || undefined) as PaymentTerms | undefined,
        notes: formData.notes || '',
        discount: safeDiscount,
        taxRate: safeTaxRateDecimal,
        items: formData.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

      if (!updated) {
        toast.error('Invoice not found');
        setIsSaving(false);
        return;
      }

      onUpdate(updated);
      setIsEditing(false);
      toast.success('Invoice saved successfully');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save invoice';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }, [formData, invoice.id, onUpdate, updateInvoice]);

  const { subtotal, total } = computeInvoiceTotals(
    formData.items,
    formData.discount,
    formData.taxRate,
  );

  return (
    <div className="space-y-6">
      <PageHeader title={isEditing ? 'Edit Invoice' : `Invoice ${invoice.invoiceNumber}`}>
        {!isEditing ? (
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/invoices')}>
              <IconArrowLeft className="mr-1.5 size-4" /> Back
            </Button>
            {invoice.status === 'draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const updated = await updateInvoiceStatus(invoice.id, 'sent');
                    if (updated) {
                      onUpdate(updated);
                      toast.success('Invoice marked as sent');
                    } else {
                      toast.error('Failed to mark as sent');
                    }
                  } catch {
                    toast.error('Failed to mark as sent');
                  }
                }}
              >
                Mark as Sent
              </Button>
            )}
            <Button variant="default" size="sm" onClick={handleEdit}>
              <IconEdit className="mr-1.5 size-4" /> Edit
            </Button>
            <InvoiceDownloadButton invoice={invoice} variant="default" />
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              <IconX className="mr-1.5 size-4" /> Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <IconLoader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <IconDeviceFloppy className="mr-1.5 size-4" />
              )}
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </>
        )}
      </PageHeader>

      {/* Header card */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <IconFileInvoice size={24} className="text-muted-foreground" />
            {isEditing ? (
              <div>
                <Label htmlFor="invoice-number" className="mb-1 block text-xs">Invoice Number</Label>
                <Input
                  id="invoice-number"
                  value={formData.invoiceNumber}
                  onChange={(e) => handleFieldChange('invoiceNumber', e.target.value)}
                  className="h-8 w-48"
                  disabled={isSaving}
                />
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">Created {formatDate(invoice.createdAt)}</p>
              </div>
            )}
          </div>
          {isEditing ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="invoice-status" className="text-xs">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => v && handleFieldChange('status', v as InvoiceStatus)}
                disabled={isSaving}
              >
                <SelectTrigger id="invoice-status" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.filter((opt) => allowedStatuses.includes(opt.value)).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge className={STATUS_COLORS[invoice.status]}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              {invoice.status === 'sent' && invoice.dueDate && new Date(invoice.dueDate) < new Date() && (
                <span className="ml-1 text-red-600">(overdue)</span>
              )}
            </Badge>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                {isEditing && (
                  <Button variant="outline" size="sm" onClick={handleAddItem} disabled={isSaving}>
                    <IconPlus className="mr-1 size-3.5" /> Add Item
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {formData.items.length === 0 && isEditing ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No line items yet</p>
                  <Button variant="outline" size="sm" onClick={handleAddItem} disabled={isSaving}>
                    <IconPlus className="mr-1 size-3.5" /> Add your first item
                  </Button>
                </div>
              ) : formData.items.length === 0 && !isEditing ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No line items on this invoice.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Description</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Qty</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Unit Price</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Total</th>
                      {isEditing && <th className="pb-2 text-right font-medium text-muted-foreground w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditing ? formData.items : invoice.items).map((item) => {
                      const isEditable = 'tempId' in item;
                      const tempId = isEditable ? (item as EditableItem).tempId : '';
                      const qty = isEditable ? (item as EditableItem).quantity : (item as import('@/types/invoice.types').InvoiceItem).quantity;
                      const unitPrice = isEditable ? (item as EditableItem).unitPrice : (item as import('@/types/invoice.types').InvoiceItem).unitPrice;
                      const desc = isEditable ? (item as EditableItem).description : (item as import('@/types/invoice.types').InvoiceItem).description;
                      const lineTotal = qty * unitPrice;

                      return (
                        <tr key={isEditable ? tempId : (item as import('@/types/invoice.types').InvoiceItem).id} className="border-b last:border-0">
                          {isEditing ? (
                            <>
                              <td className="py-2 pr-2">
                                <Input
                                  value={desc}
                                  onChange={(e) => handleItemChange(tempId, 'description', e.target.value)}
                                  placeholder="Item description"
                                  className="h-8 w-full"
                                  disabled={isSaving}
                                />
                              </td>
                              <td className="py-2 px-1">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={qty}
                                  onChange={(e) => handleItemChange(tempId, 'quantity', Number(e.target.value))}
                                  className="h-8 w-20 text-right"
                                  disabled={isSaving}
                                />
                              </td>
                              <td className="py-2 px-1">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={unitPrice}
                                  onChange={(e) => handleItemChange(tempId, 'unitPrice', Number(e.target.value))}
                                  className="h-8 w-28 text-right"
                                  disabled={isSaving}
                                />
                              </td>
                              <td className="py-2 pl-2 text-right font-medium">
                                {formatCurrency(lineTotal)}
                              </td>
                              <td className="py-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemoveItem(tempId)}
                                  disabled={isSaving}
                                >
                                  <IconTrash className="size-4" />
                                </Button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 font-medium">{desc}</td>
                              <td className="py-3 text-right">{qty}</td>
                              <td className="py-3 text-right">{formatCurrency(unitPrice)}</td>
                              <td className="py-3 text-right font-medium">{formatCurrency(lineTotal)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Summary card */}
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {isEditing ? (
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="invoice-discount" className="text-sm text-muted-foreground">Discount</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-destructive">-</span>
                    <Input
                      id="invoice-discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.discount}
                      onChange={(e) => handleFieldChange('discount', Number(e.target.value))}
                      className="h-7 w-24 text-right"
                      disabled={isSaving}
                    />
                  </div>
                </div>
              ) : (
                invoice.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-destructive">-{formatCurrency(invoice.discount)}</span>
                  </div>
                )
              )}
              {isEditing ? (
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="invoice-tax-rate" className="text-sm text-muted-foreground">Tax Rate (%)</Label>
                  <Input
                    id="invoice-tax-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.taxRate}
                    onChange={(e) => handleFieldChange('taxRate', Number(e.target.value))}
                    className="h-7 w-24 text-right"
                    disabled={isSaving}
                  />
                </div>
              ) : (
                invoice.taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax ({(invoice.taxRate * 100).toFixed(1)}%)</span>
                    <span>{formatCurrency(invoice.tax)}</span>
                  </div>
                )
              )}
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total Due</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Details card */}
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* Status */}
              {isEditing ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="detail-status" className="text-xs">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => v && handleFieldChange('status', v as InvoiceStatus)}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="detail-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.filter((opt) => allowedStatuses.includes(opt.value)).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={STATUS_COLORS[invoice.status]}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    {invoice.status === 'sent' && invoice.dueDate && new Date(invoice.dueDate) < new Date() && (
                      <span className="ml-1 text-red-600">(overdue)</span>
                    )}
                  </Badge>
                </div>
              )}

              {/* Due date */}
              {isEditing ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="detail-due-date" className="text-xs">Due Date</Label>
                  <Input
                    id="detail-due-date"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                    className="h-8 w-full"
                    disabled={isSaving}
                  />
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{invoice.dueDate ? formatDate(invoice.dueDate) : '-'}</span>
                </div>
              )}

              {/* Payment terms */}
              {isEditing ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="detail-payment-terms" className="text-xs">Payment Terms</Label>
                  <Select
                    value={formData.paymentTerms}
                    onValueChange={(v) => handleFieldChange('paymentTerms', v || '')}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="detail-payment-terms" className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {PAYMENT_TERMS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                invoice.paymentTerms && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Terms</span>
                    <span className="font-medium capitalize">{invoice.paymentTerms.replace('net-', 'Net ')}</span>
                  </div>
                )
              )}

              {/* Paid at — always read-only display */}
              {invoice.paidAt && !isEditing && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid At</span>
                  <span>{formatDate(invoice.paidAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes card */}
          {isEditing ? (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  placeholder="Add notes..."
                  className="min-h-24 w-full"
                  disabled={isSaving}
                />
              </CardContent>
            </Card>
          ) : (
            invoice.notes && (
              <Card>
                <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getById } = useInvoices();
  const [invoice, setInvoice] = useState<import('@/types/invoice.types').Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const id = typeof params.id === 'string' ? params.id : '';
        const data = await getById(id);
        if (!cancelled) setInvoice(data ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load invoice');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.id, getById]);

  const handleUpdate = useCallback((updated: import('@/types/invoice.types').Invoice) => {
    setInvoice(updated);
  }, []);

  if (loading) return <LoadingState />;
  if (error || !invoice) return <ErrorDisplay error={error} onBack={() => router.push('/invoices')} />;
  return <InvoiceContent invoice={invoice} onUpdate={handleUpdate} />;
}
