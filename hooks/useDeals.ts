'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Deal, DealFormData, DealStage, DealStageFormData } from '@/types/deal.types';
import { dealService } from '@/services/deal.service';

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      await refresh();
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refresh]);

  const createDeal = useCallback(async (data: DealFormData) => {
    const tempId = `temp-${Date.now()}`;
    const optimistic = { ...data, id: tempId, createdAt: new Date().toISOString(), winLossReason: '', createdBy: 'user-1', updatedAt: '', description: data.description ?? '', value: data.value ?? 0, currency: data.currency ?? 'USD' } as Deal;
    setDeals((prev) => [optimistic, ...prev]);
    try {
      const created = await dealService.create(data);
      setDeals((prev) => prev.map((d) => (d.id === tempId ? created : d)));
      return created;
    } catch (e) {
      setDeals((prev) => prev.filter((d) => d.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create deal');
      return undefined;
    }
  }, []);

  const updateDeal = useCallback(async (id: string, data: Partial<DealFormData>) => {
    const previous = deals;
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...data } : d)));
    try {
      const updated = await dealService.update(id, data);
      if (updated) setDeals((prev) => prev.map((d) => (d.id === id ? updated : d)));
      return updated;
    } catch (e) {
      setDeals(previous);
      setError(e instanceof Error ? e.message : 'Failed to update deal');
      return undefined;
    }
  }, [deals]);

  const deleteDeal = useCallback(async (id: string) => {
    const previous = deals;
    setDeals((prev) => prev.filter((d) => d.id !== id));
    try {
      await dealService.delete(id);
      return true;
    } catch (e) {
      setDeals(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete deal');
      return false;
    }
  }, [deals]);

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
    const previous = stages;
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    try {
      const updated = await dealService.updateStage(id, data);
      if (updated) setStages((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    } catch (e) {
      setStages(previous);
      setError(e instanceof Error ? e.message : 'Failed to update stage');
      return undefined;
    }
  }, [stages]);

  const deleteStage = useCallback(async (id: string) => {
    const previous = stages;
    setStages((prev) => prev.filter((s) => s.id !== id));
    try {
      await dealService.deleteStage(id);
      return true;
    } catch (e) {
      setStages(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete stage');
      return false;
    }
  }, [stages]);

  const getPipeline = useCallback(async () => {
    try {
      return await dealService.getPipeline();
    } catch {
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
