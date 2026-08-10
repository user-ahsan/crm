'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Invoice, InvoiceFormData, InvoiceStatus } from '@/types/invoice.types';
import { generateId } from '@/lib/formatters';
import { invoiceService } from '@/services/invoice.service';
import { useEntityCache, isCacheStale } from '@/store/entity-cache';

/**
 * Cents-rounding rule for invoice money math — mirrors invoice.service.ts (F15):
 * per-item total, subtotal, discount, tax and total are rounded to cents so
 * float noise is never shown (or persisted) in the optimistic row.
 */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Cents-rounding with a NaN guard so invalid input never renders NaN. */
function safeTotal(value: number): number {
  return Number.isFinite(value) ? roundCents(value) : 0;
}

interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

function computeInvoiceTotals(items: InvoiceLineInput[], discount = 0, taxRate = 0) {
  const itemTotals = items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    total: safeTotal(i.quantity * i.unitPrice),
  }));
  const subtotal = roundCents(itemTotals.reduce((sum, i) => sum + i.total, 0));
  const discountRounded = roundCents(discount);
  const afterDiscount = roundCents(Math.max(0, subtotal - discountRounded));
  const rate = Number.isFinite(taxRate) ? taxRate : 0;
  const tax = roundCents(afterDiscount * rate);
  return {
    itemTotals,
    subtotal,
    discount: discountRounded,
    tax,
    total: roundCents(afterDiscount + tax),
  };
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    invoices: cachedInvoices,
    setInvoices: setCachedInvoices,
    updateInvoice: updateCachedInvoice,
    removeInvoice: removeCachedInvoice,
    lastFetched,
    setLastFetched,
  } = useEntityCache();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoiceService.getAll();
      setInvoices(data);
      setCachedInvoices(data);
      setLastFetched('invoices');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [setCachedInvoices, setLastFetched]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isCacheStale({ lastFetched }, 'invoices') && cachedInvoices.length > 0) {
        setInvoices(cachedInvoices);
        setLoading(false);
        return;
      }
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh, cachedInvoices, lastFetched]);

  const getById = useCallback(async (id: string) => {
    try {
      return await invoiceService.getById(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoice');
      return undefined;
    }
  }, []);

  const createInvoice = useCallback(async (data: InvoiceFormData) => {
    const tempId = generateId();
    const { itemTotals, subtotal, discount, tax, total } = computeInvoiceTotals(
      data.items,
      data.discount ?? 0,
      data.taxRate ?? 0,
    );
    const optimisticItem: Invoice = {
      id: tempId,
      invoiceNumber: data.invoiceNumber || 'DRAFT',
      status: 'draft',
      subtotal,
      discount,
      taxRate: data.taxRate ?? 0,
      tax,
      total,
      notes: data.notes ?? '',
      createdBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: itemTotals.map((i, idx) => ({
        id: '',
        invoiceId: tempId,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
        sortOrder: idx,
      })),
      quoteId: data.quoteId,
      dueDate: data.dueDate,
      paymentTerms: data.paymentTerms,
    };
    setInvoices((prev) => [optimisticItem, ...prev]);
    try {
      const created = await invoiceService.create(data);
      setInvoices((prev) => prev.map((inv) => (inv.id === tempId ? created : inv)));
      // ponytail: sync cache — replace temp item with server response
      const cached = useEntityCache.getState().invoices;
      const existing = cached.find((inv) => inv.id === tempId);
      if (existing) {
        setCachedInvoices(cached.map((inv) => (inv.id === tempId ? created : inv)));
      } else {
        setCachedInvoices([created, ...cached]);
      }
      return created;
    } catch (e) {
      setInvoices((prev) => prev.filter((inv) => inv.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create invoice');
      return undefined;
    }
  }, [setCachedInvoices]);

  const updateInvoice = useCallback(async (id: string, data: Partial<InvoiceFormData>) => {
    // Capture the pre-mutation row OUTSIDE the state updater so rollback can
    // restore the exact object at its original index (ARCHITECTURE §10).
    const prevItem = invoices.find((inv) => inv.id === id);
    if (!prevItem) return undefined;
    const prevIndex = invoices.indexOf(prevItem);
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== id) return inv;
        const items = data.items !== undefined
          ? data.items.map((item, idx) => ({
              id: inv.items[idx]?.id ?? '',
              invoiceId: inv.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: safeTotal(item.quantity * item.unitPrice),
              sortOrder: inv.items[idx]?.sortOrder ?? idx,
            }))
          : inv.items;
        const totals = computeInvoiceTotals(
          items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
          data.discount ?? inv.discount,
          data.taxRate ?? inv.taxRate,
        );
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          title: data.title ?? inv.title,
          quoteId: data.quoteId ?? inv.quoteId,
          leadId: data.leadId ?? inv.leadId,
          contactId: data.contactId ?? inv.contactId,
          companyId: data.companyId ?? inv.companyId,
          status: data.status ?? inv.status,
          subtotal: totals.subtotal,
          discount: totals.discount,
          taxRate: data.taxRate ?? inv.taxRate,
          tax: totals.tax,
          total: totals.total,
          notes: data.notes ?? inv.notes,
          dueDate: data.dueDate ?? inv.dueDate,
          paidAt: inv.paidAt,
          paymentTerms: data.paymentTerms ?? inv.paymentTerms,
          companyName: data.companyName ?? inv.companyName,
          companyAddress: data.companyAddress ?? inv.companyAddress,
          companyEmail: data.companyEmail ?? inv.companyEmail,
          companyPhone: data.companyPhone ?? inv.companyPhone,
          createdBy: inv.createdBy,
          createdAt: inv.createdAt,
          updatedAt: inv.updatedAt,
          items,
        };
      }),
    );
    try {
      const updated = await invoiceService.update(id, data);
      if (!updated) {
        // Not-found: revert the optimistic change and surface it.
        setInvoices((prev) => {
          const next = prev.filter((inv) => inv.id !== id);
          next.splice(Math.min(prevIndex, next.length), 0, prevItem);
          return next;
        });
        setError('Failed to update invoice: record not found');
        return undefined;
      }
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
      updateCachedInvoice(id, updated);
      return updated;
    } catch (e) {
      setInvoices((prev) => {
        const next = prev.filter((inv) => inv.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to update invoice');
      return undefined;
    }
  }, [invoices, updateCachedInvoice]);

  const deleteInvoice = useCallback(async (id: string) => {
    const prevItem = invoices.find((inv) => inv.id === id);
    if (!prevItem) return false;
    const prevIndex = invoices.indexOf(prevItem);
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    try {
      await invoiceService.delete(id);
      removeCachedInvoice(id);
      return true;
    } catch (e) {
      setInvoices((prev) => {
        const next = prev.filter((inv) => inv.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to delete invoice');
      return false;
    }
  }, [invoices, removeCachedInvoice]);

  const updateInvoiceStatus = useCallback(async (id: string, status: InvoiceStatus) => {
    const prevItem = invoices.find((inv) => inv.id === id);
    if (!prevItem) return undefined;
    const prevIndex = invoices.indexOf(prevItem);
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status } : inv)));
    try {
      const updated = await invoiceService.updateStatus(id, status);
      if (!updated) {
        // Not-found: revert the optimistic change and surface it.
        setInvoices((prev) => {
          const next = prev.filter((inv) => inv.id !== id);
          next.splice(Math.min(prevIndex, next.length), 0, prevItem);
          return next;
        });
        setError('Failed to update status: record not found');
        return undefined;
      }
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
      updateCachedInvoice(id, updated);
      return updated;
    } catch (e) {
      setInvoices((prev) => {
        const next = prev.filter((inv) => inv.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to update status');
      return undefined;
    }
  }, [invoices, updateCachedInvoice]);

  return {
    invoices,
    loading,
    error,
    refresh,
    getById,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    updateInvoiceStatus,
  };
}
