'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Invoice, InvoiceFormData, InvoiceStatus } from '@/types/invoice.types';
import { invoiceService } from '@/services/invoice.service';

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoiceService.getAll();
      setInvoices(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
    })();
  }, [refresh]);

  const createInvoice = useCallback(async (data: InvoiceFormData) => {
    const tempId = `temp-${Date.now()}`;
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
      return created;
    } catch (e) {
      setInvoices((prev) => prev.filter((inv) => inv.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create invoice');
      return undefined;
    }
  }, []);

  const updateInvoice = useCallback(async (id: string, data: Partial<InvoiceFormData>) => {
    const previous = invoices;
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, ...data } as Invoice : inv)));
    try {
      const updated = await invoiceService.update(id, data);
      if (updated) {
        setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
      }
      return updated;
    } catch (e) {
      setInvoices(previous);
      setError(e instanceof Error ? e.message : 'Failed to update invoice');
      return undefined;
    }
  }, [invoices]);

  const deleteInvoice = useCallback(async (id: string) => {
    const previous = invoices;
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    try {
      await invoiceService.delete(id);
      return true;
    } catch (e) {
      setInvoices(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete invoice');
      return false;
    }
  }, [invoices]);

  const updateInvoiceStatus = useCallback(async (id: string, status: InvoiceStatus) => {
    const previous = invoices;
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status } : inv)));
    try {
      const updated = await invoiceService.updateStatus(id, status);
      if (updated) {
        setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
      }
      return updated;
    } catch (e) {
      setInvoices(previous);
      setError(e instanceof Error ? e.message : 'Failed to update status');
      return undefined;
    }
  }, [invoices]);

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
