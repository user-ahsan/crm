'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Quote, QuoteFormData, QuoteStatus } from '@/types/quote.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { IconX, IconPlus, IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

const QUOTE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected'];

interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface QuoteCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuote?: Quote;
  onCreate: (data: QuoteFormData) => Promise<Quote | undefined>;
  onUpdate: (id: string, data: Partial<QuoteFormData>) => Promise<Quote | undefined>;
}

function emptyItem(): LineItemInput {
  return { description: '', quantity: 1, unitPrice: 0 };
}

export function QuoteCreateDialog({
  open,
  onOpenChange,
  editQuote,
  onCreate,
  onUpdate,
}: QuoteCreateDialogProps) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<QuoteStatus>('draft');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<LineItemInput[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);

  const isEditMode = !!editQuote;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (open) {
      if (editQuote) {
        setTitle(editQuote.title);
        setStatus(editQuote.status);
        setDiscount(editQuote.discount);
        setNotes(editQuote.notes);
        setValidUntil(editQuote.validUntil ?? '');
        setItems(
          editQuote.items.length > 0
            ? editQuote.items.map((i) => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
              }))
            : [emptyItem()],
        );
      } else {
        setTitle('');
        setStatus('draft');
        setDiscount(0);
        setNotes('');
        setValidUntil('');
        setItems([emptyItem()]);
      }
      setSubmitting(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editQuote]);

  const updateItem = useCallback(
    (index: number, field: keyof LineItemInput, value: string | number) => {
      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    [],
  );

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItem()]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);

  const validate = useCallback((): boolean => {
    if (!title.trim()) {
      toast.error('Title is required');
      return false;
    }
    if (items.some((i) => !i.description.trim())) {
      toast.error('All line items must have a description');
      return false;
    }
    if (items.some((i) => i.quantity <= 0)) {
      toast.error('All quantities must be greater than 0');
      return false;
    }
    if (items.some((i) => i.unitPrice < 0)) {
      toast.error('Unit prices cannot be negative');
      return false;
    }
    if (discount < 0) {
      toast.error('Discount cannot be negative');
      return false;
    }
    return true;
  }, [title, items, discount]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const data: QuoteFormData = {
        title: title.trim(),
        status,
        discount,
        notes,
        validUntil: validUntil || undefined,
        items: items.map((i) => ({
          description: i.description.trim(),
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      };

      if (isEditMode && editQuote) {
        const updated = await onUpdate(editQuote.id, data);
        if (updated) {
          toast.success('Quote updated successfully');
          onOpenChange(false);
        } else {
          toast.error('Failed to update quote');
        }
      } else {
        const created = await onCreate(data);
        if (created) {
          toast.success('Quote created successfully');
          onOpenChange(false);
        } else {
          toast.error('Failed to create quote');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [validate, title, status, discount, notes, validUntil, items, isEditMode, editQuote, onCreate, onUpdate, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Quote' : 'Create New Quote'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the quote details below.'
              : 'Fill in the details below to create a new quote.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-6 overflow-y-auto px-1">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="quoteTitle">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quoteTitle"
              placeholder="Q4 Enterprise Package"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Status (edit mode only) */}
          {isEditMode && (
            <div className="grid gap-2">
              <Label htmlFor="quoteStatus">Status</Label>
              <Select
                value={status}
                onValueChange={(v: string | null) => { if (v) setStatus(v as QuoteStatus); }}
                disabled={submitting}
              >
                <SelectTrigger id="quoteStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUOTE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Line Items */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                disabled={submitting}
              >
                <IconPlus className="mr-1 size-3.5" />
                Add Item
              </Button>
            </div>

            {/* Header Row */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
              <div className="col-span-5">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1" />
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-5">
                  <Input
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={1}
                    placeholder="1"
                    value={item.quantity || ''}
                    onChange={(e) =>
                      updateItem(idx, 'quantity', Math.max(1, Number(e.target.value)))
                    }
                    className="text-right"
                    disabled={submitting}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    value={item.unitPrice || ''}
                    onChange={(e) =>
                      updateItem(idx, 'unitPrice', Math.max(0, Number(e.target.value)))
                    }
                    className="text-right"
                    disabled={submitting}
                  />
                </div>
                <div className="col-span-2 flex items-center justify-end px-2 text-sm tabular-nums font-medium">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length <= 1 || submitting}
                    className="flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive transition-colors disabled:opacity-30"
                    aria-label="Remove item"
                  >
                    <IconX className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="grid gap-2 sm:w-48">
                <Label htmlFor="discount">Discount</Label>
                <Input
                  id="discount"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1 text-right">
                <p className="text-sm text-muted-foreground">
                  Subtotal: <span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
                </p>
                {discount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Discount: -<span className="font-medium tabular-nums">{formatCurrency(discount)}</span>
                  </p>
                )}
                <p className="text-base font-semibold">
                  Total: <span className="tabular-nums">{formatCurrency(total)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="quoteNotes">Notes</Label>
            <Textarea
              id="quoteNotes"
              placeholder="Payment terms, delivery details, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={submitting}
            />
          </div>

          {/* Valid Until */}
          <div className="grid gap-2 sm:w-48">
            <Label htmlFor="validUntil">Valid Until</Label>
            <Input
              id="validUntil"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <IconLoader2 className="mr-2 size-4 animate-spin" />}
            {submitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Quote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
