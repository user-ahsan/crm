'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Quote, QuoteFormData, QuoteStatus } from '@/types/quote.types';
import { generateId } from '@/lib/formatters';
import { quoteService } from '@/services/quote.service';
import { useEntityCache, isCacheStale } from '@/store/entity-cache';

export function useQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    quotes: cachedQuotes,
    setQuotes: setCachedQuotes,
    updateQuote: updateCachedQuote,
    removeQuote: removeCachedQuote,
    lastFetched,
    setLastFetched,
  } = useEntityCache();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await quoteService.getAll();
      setQuotes(data);
      setCachedQuotes(data);
      setLastFetched('quotes');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [setCachedQuotes, setLastFetched]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isCacheStale({ lastFetched }, 'quotes') && cachedQuotes.length > 0) {
        setQuotes(cachedQuotes);
        setLoading(false);
        return;
      }
      if (cancelled) return;
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh, cachedQuotes, lastFetched]);

  const createQuote = useCallback(async (data: QuoteFormData) => {
    const tempId = generateId();
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
      // ponytail: sync cache — replace temp item with server response
      const cached = useEntityCache.getState().quotes;
      const existing = cached.find((q) => q.id === tempId);
      if (existing) {
        setCachedQuotes(cached.map((q) => (q.id === tempId ? created : q)));
      } else {
        setCachedQuotes([created, ...cached]);
      }
      return created;
    } catch (e) {
      setQuotes((prev) => prev.filter((q) => q.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create quote');
      return undefined;
    }
  }, [setCachedQuotes]);

  const updateQuote = useCallback(async (id: string, data: Partial<QuoteFormData>) => {
    let prevItem: Quote | undefined;
    setQuotes((prev) => {
      prevItem = prev.find((q) => q.id === id);
      return prev.map((q) => (q.id === id ? { ...q, ...data, items: q.items } as Quote : q));
    });
    try {
      const updated = await quoteService.update(id, data);
      if (updated) {
        setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
        updateCachedQuote(id, updated);
      }
      return updated;
    } catch (e) {
      if (prevItem) setQuotes((prev) => prev.map((q) => (q.id === id ? prevItem! : q)));
      setError(e instanceof Error ? e.message : 'Failed to update quote');
      return undefined;
    }
  }, [updateCachedQuote]);

  const deleteQuote = useCallback(async (id: string) => {
    let prevItem: Quote | undefined;
    setQuotes((prev) => {
      prevItem = prev.find((q) => q.id === id);
      return prev.filter((q) => q.id !== id);
    });
    try {
      await quoteService.delete(id);
      removeCachedQuote(id);
      return true;
    } catch (e) {
      if (prevItem) setQuotes((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete quote');
      return false;
    }
  }, [removeCachedQuote]);

  const updateStatus = useCallback(async (id: string, status: QuoteStatus) => {
    let prevItem: Quote | undefined;
    setQuotes((prev) => {
      prevItem = prev.find((q) => q.id === id);
      return prev.map((q) => (q.id === id ? { ...q, status } : q));
    });
    try {
      const updated = await quoteService.updateStatus(id, status);
      if (updated) {
        setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
        updateCachedQuote(id, updated);
      }
      return updated;
    } catch (e) {
      if (prevItem) setQuotes((prev) => prev.map((q) => (q.id === id ? prevItem! : q)));
      setError(e instanceof Error ? e.message : 'Failed to update status');
      return undefined;
    }
  }, [updateCachedQuote]);

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
