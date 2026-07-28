'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Invoice, InvoiceFormData, InvoiceStatus } from '@/types/invoice.types';
import { generateId } from '@/lib/formatters';
import { invoiceService } from '@/services/invoice.service';
import { useEntityCache, isCacheStale } from '@/store/entity-cache';

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

  const createInvoice = useCallback(async (data: InvoiceFormData) => {
    const tempId = generateId();
    const optimisticItem: Invoice = {
      id: tempId,
      invoiceNumber: data.invoiceNumber || 'DRAFT',
      status: 'draft',
      subtotal: 0,
      discount: data.discount ?? 0,
      taxRate: data.taxRate ?? 0,
      tax: 0,
      total: 0,
      notes: data.notes ?? '',
      createdBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: data.items.map((i) => ({
        id: '',
        invoiceId: tempId,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.quantity * i.unitPrice,
        sortOrder: 0,
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
    let previous: Invoice[] | undefined;
    setInvoices((prev) => { previous = [...prev]; return prev.map((inv) => (inv.id === id ? { ...inv, ...data } as Invoice : inv)); });
    try {
      const updated = await invoiceService.update(id, data);
      if (updated) {
        setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
        updateCachedInvoice(id, updated);
      }
      return updated;
    } catch (e) {
      if (previous) setInvoices(previous);
      setError(e instanceof Error ? e.message : 'Failed to update invoice');
      return undefined;
    }
  }, [updateCachedInvoice]);

  const deleteInvoice = useCallback(async (id: string) => {
    let previous: Invoice[] | undefined;
    setInvoices((prev) => { previous = [...prev]; return prev.filter((inv) => inv.id !== id); });
    try {
      await invoiceService.delete(id);
      removeCachedInvoice(id);
      return true;
    } catch (e) {
      if (previous) setInvoices(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete invoice');
      return false;
    }
  }, [removeCachedInvoice]);

  const updateInvoiceStatus = useCallback(async (id: string, status: InvoiceStatus) => {
    let previous: Invoice[] | undefined;
    setInvoices((prev) => { previous = [...prev]; return prev.map((inv) => (inv.id === id ? { ...inv, status } : inv)); });
    try {
      const updated = await invoiceService.updateStatus(id, status);
      if (updated) {
        setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
        updateCachedInvoice(id, updated);
      }
      return updated;
    } catch (e) {
      if (previous) setInvoices(previous);
      setError(e instanceof Error ? e.message : 'Failed to update status');
      return undefined;
    }
  }, [updateCachedInvoice]);

  return {
    invoices,
    loading,
    error,
    refresh,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    updateInvoiceStatus,
  };
}
