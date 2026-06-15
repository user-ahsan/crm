'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Quote, QuoteFormData, QuoteStatus } from '@/types/quote.types';
import { quoteService } from '@/services/quote.service';

export function useQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await quoteService.getAll();
      setQuotes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
    })();
  }, [refresh]);

  const createQuote = useCallback(async (data: QuoteFormData) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: Quote = {
      id: tempId,
      title: data.title,
      status: 'draft',
      subtotal: 0,
      discount: data.discount ?? 0,
      total: 0,
      notes: data.notes ?? '',
      createdBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: data.items.map((i) => ({
        id: '',
        quoteId: tempId,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.quantity * i.unitPrice,
        sortOrder: 0,
      })),
      dealId: data.dealId,
      leadId: data.leadId,
      contactId: data.contactId,
      companyId: data.companyId,
      validUntil: data.validUntil,
    };
    setQuotes((prev) => [optimisticItem, ...prev]);
    try {
      const created = await quoteService.create(data);
      setQuotes((prev) => prev.map((q) => (q.id === tempId ? created : q)));
      return created;
    } catch (e) {
      setQuotes((prev) => prev.filter((q) => q.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create quote');
      return undefined;
    }
  }, []);

  const updateQuote = useCallback(async (id: string, data: Partial<QuoteFormData>) => {
    const previous = quotes;
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, ...data, items: q.items } as Quote : q)));
    try {
      const updated = await quoteService.update(id, data);
      if (updated) {
        setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
      }
      return updated;
    } catch (e) {
      setQuotes(previous);
      setError(e instanceof Error ? e.message : 'Failed to update quote');
      return undefined;
    }
  }, [quotes]);

  const deleteQuote = useCallback(async (id: string) => {
    const previous = quotes;
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    try {
      await quoteService.delete(id);
      return true;
    } catch (e) {
      setQuotes(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete quote');
      return false;
    }
  }, [quotes]);

  const updateStatus = useCallback(async (id: string, status: QuoteStatus) => {
    const previous = quotes;
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    try {
      const updated = await quoteService.updateStatus(id, status);
      if (updated) {
        setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
      }
      return updated;
    } catch (e) {
      setQuotes(previous);
      setError(e instanceof Error ? e.message : 'Failed to update status');
      return undefined;
    }
  }, [quotes]);

  return {
    quotes,
    loading,
    error,
    refresh,
    createQuote,
    updateQuote,
    deleteQuote,
    updateStatus,
  };
}
