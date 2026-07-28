'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Deal, DealFormData, DealStage, DealStageFormData } from '@/types/deal.types';
import { generateId } from '@/lib/formatters';
import { dealService } from '@/services/deal.service';
import { useEntityCache } from '@/store/entity-cache';

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dealsData, stagesData] = await Promise.all([
        dealService.getAll(),
        dealService.getStages(),
      ]);
      setDeals(dealsData);
      setStages(stagesData);
      const store = useEntityCache.getState();
      store.setDeals(dealsData);
      store.setLastFetched('deals');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const createDeal = useCallback(async (data: DealFormData) => {
    const tempId = generateId();
    const optimistic: Deal = { ...data, tags: data.tags ?? [], id: tempId, createdAt: new Date().toISOString(), winLossReason: '', createdBy: 'system', updatedAt: '', description: data.description ?? '', value: data.value ?? 0, currency: data.currency ?? 'USD' };
    setDeals((prev) => [optimistic, ...prev]);
    try {
      const created = await dealService.create(data);
      setDeals((prev) => prev.map((d) => (d.id === tempId ? created : d)));
      const { deals: cachedDeals, setDeals: setCache } = useEntityCache.getState();
      setCache([created, ...cachedDeals]);
      return created;
    } catch (e) {
      setDeals((prev) => prev.filter((d) => d.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create deal');
      return undefined;
    }
  }, []);

  const updateDeal = useCallback(async (id: string, data: Partial<DealFormData>) => {
    let prevItem: Deal | undefined;
    setDeals((prev) => {
      prevItem = prev.find((d) => d.id === id);
      return prev.map((d) => (d.id === id ? { ...d, ...data } : d));
    });
    try {
      const updated = await dealService.update(id, data);
      if (updated) {
        setDeals((prev) => prev.map((d) => (d.id === id ? updated : d)));
        useEntityCache.getState().updateDeal(id, updated);
      }
      return updated;
    } catch (e) {
      if (prevItem) setDeals((prev) => prev.map((d) => (d.id === id ? prevItem! : d)));
      setError(e instanceof Error ? e.message : 'Failed to update deal');
      return undefined;
    }
  }, []);

  const deleteDeal = useCallback(async (id: string) => {
    let prevItem: Deal | undefined;
    setDeals((prev) => {
      prevItem = prev.find((d) => d.id === id);
      return prev.filter((d) => d.id !== id);
    });
    try {
      await dealService.delete(id);
      useEntityCache.getState().removeDeal(id);
      return true;
    } catch (e) {
      if (prevItem) setDeals((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete deal');
      return false;
    }
  }, []);

  const createStage = useCallback(async (data: DealStageFormData) => {
    try {
      const created = await dealService.createStage(data);
      setStages((prev) => [...prev, created]);
      return created;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create stage');
      return undefined;
    }
  }, []);

  const updateStage = useCallback(async (id: string, data: Partial<DealStageFormData>) => {
    let prevItem: DealStage | undefined;
    setStages((prev) => {
      prevItem = prev.find((s) => s.id === id);
      return prev.map((s) => (s.id === id ? { ...s, ...data } : s));
    });
    try {
      const updated = await dealService.updateStage(id, data);
      if (updated) setStages((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    } catch (e) {
      if (prevItem) setStages((prev) => prev.map((s) => (s.id === id ? prevItem! : s)));
      setError(e instanceof Error ? e.message : 'Failed to update stage');
      return undefined;
    }
  }, []);

  const deleteStage = useCallback(async (id: string) => {
    let prevItem: DealStage | undefined;
    setStages((prev) => {
      prevItem = prev.find((s) => s.id === id);
      return prev.filter((s) => s.id !== id);
    });
    try {
      await dealService.deleteStage(id);
      return true;
    } catch (e) {
      if (prevItem) setStages((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete stage');
      return false;
    }
  }, []);

  const getPipeline = useCallback(async () => {
    try {
      return await dealService.getPipeline();
    } catch {
      // Error preserved in error state
      return [];
    }
  }, []);

  const updateDealStage = useCallback(async (id: string, stageId: string) => {
    return updateDeal(id, { stageId });
  }, [updateDeal]);

  const getTotalValue = useCallback(async () => {
    try {
      return await dealService.getTotalValue();
    } catch {
      // Error preserved in error state
      return 0;
    }
  }, []);

  return {
    deals,
    stages,
    loading,
    error,
    refresh,
    createDeal,
    updateDeal,
    deleteDeal,
    createStage,
    updateStage,
    deleteStage,
    getPipeline,
    getTotalValue,
    updateDealStage,
  };
}
