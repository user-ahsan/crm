'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Quote, QuoteFormData, QuoteStatus } from '@/types/quote.types';
import { generateId } from '@/lib/formatters';
import { quoteService } from '@/services/quote.service';
import { useEntityCache, isCacheStale } from '@/store/entity-cache';

/**
 * Cents-rounding rule for quote money math — mirrors quote.service.ts (F15):
 * per-item total, subtotal, discount and total are rounded to cents so float
 * noise is never shown (or persisted) in the optimistic row.
 */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Cents-rounding with a NaN guard so invalid input never renders NaN. */
function safeTotal(value: number): number {
  return Number.isFinite(value) ? roundCents(value) : 0;
}

interface QuoteLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

function computeQuoteTotals(items: QuoteLineInput[], discount = 0) {
  const itemTotals = items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    total: safeTotal(i.quantity * i.unitPrice),
  }));
  const subtotal = roundCents(itemTotals.reduce((sum, i) => sum + i.total, 0));
  const discountRounded = roundCents(discount);
  return {
    itemTotals,
    subtotal,
    discount: discountRounded,
    total: roundCents(Math.max(0, subtotal - discountRounded)),
  };
}

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

  const getById = useCallback(async (id: string) => {
    try {
      return await quoteService.getById(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quote');
      return undefined;
    }
  }, []);

  const createQuote = useCallback(async (data: QuoteFormData) => {
    const tempId = generateId();
    const { itemTotals, subtotal, discount, total } = computeQuoteTotals(data.items, data.discount ?? 0);
    const optimisticItem: Quote = {
      id: tempId,
      title: data.title,
      status: 'draft',
      subtotal,
      discount,
      total,
      notes: data.notes ?? '',
      createdBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: itemTotals.map((i, idx) => ({
        id: '',
        quoteId: tempId,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
        sortOrder: idx,
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
    // Capture the pre-mutation row OUTSIDE the state updater so rollback can
    // restore the exact object at its original index (ARCHITECTURE §10).
    const prevItem = quotes.find((q) => q.id === id);
    if (!prevItem) return undefined;
    const prevIndex = quotes.indexOf(prevItem);
    setQuotes((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const items = data.items !== undefined
          ? data.items.map((item, idx) => ({
              id: q.items[idx]?.id ?? '',
              quoteId: q.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: safeTotal(item.quantity * item.unitPrice),
              sortOrder: q.items[idx]?.sortOrder ?? idx,
            }))
          : q.items;
        const totals = computeQuoteTotals(
          items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
          data.discount ?? q.discount,
        );
        return {
          id: q.id,
          title: data.title ?? q.title,
          dealId: data.dealId ?? q.dealId,
          leadId: data.leadId ?? q.leadId,
          contactId: data.contactId ?? q.contactId,
          companyId: data.companyId ?? q.companyId,
          status: data.status ?? q.status,
          subtotal: totals.subtotal,
          discount: totals.discount,
          total: totals.total,
          notes: data.notes ?? q.notes,
          validUntil: data.validUntil ?? q.validUntil,
          createdBy: q.createdBy,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
          items,
        };
      }),
    );
    try {
      const updated = await quoteService.update(id, data);
      if (!updated) {
        // Not-found: revert the optimistic change and surface it.
        setQuotes((prev) => {
          const next = prev.filter((q) => q.id !== id);
          next.splice(Math.min(prevIndex, next.length), 0, prevItem);
          return next;
        });
        setError('Failed to update quote: record not found');
        return undefined;
      }
      setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
      updateCachedQuote(id, updated);
      return updated;
    } catch (e) {
      setQuotes((prev) => {
        const next = prev.filter((q) => q.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to update quote');
      return undefined;
    }
  }, [quotes, updateCachedQuote]);

  const deleteQuote = useCallback(async (id: string) => {
    const prevItem = quotes.find((q) => q.id === id);
    if (!prevItem) return false;
    const prevIndex = quotes.indexOf(prevItem);
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    try {
      await quoteService.delete(id);
      removeCachedQuote(id);
      return true;
    } catch (e) {
      setQuotes((prev) => {
        const next = prev.filter((q) => q.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to delete quote');
      return false;
    }
  }, [quotes, removeCachedQuote]);

  const updateStatus = useCallback(async (id: string, status: QuoteStatus) => {
    const prevItem = quotes.find((q) => q.id === id);
    if (!prevItem) return undefined;
    const prevIndex = quotes.indexOf(prevItem);
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    try {
      const updated = await quoteService.updateStatus(id, status);
      if (!updated) {
        // Not-found: revert the optimistic change and surface it.
        setQuotes((prev) => {
          const next = prev.filter((q) => q.id !== id);
          next.splice(Math.min(prevIndex, next.length), 0, prevItem);
          return next;
        });
        setError('Failed to update status: record not found');
        return undefined;
      }
      setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
      updateCachedQuote(id, updated);
      return updated;
    } catch (e) {
      setQuotes((prev) => {
        const next = prev.filter((q) => q.id !== id);
        next.splice(Math.min(prevIndex, next.length), 0, prevItem);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to update status');
      return undefined;
    }
  }, [quotes, updateCachedQuote]);

  return {
    quotes,
    loading,
    error,
    refresh,
    getById,
    createQuote,
    updateQuote,
    deleteQuote,
    updateStatus,
  };
}
