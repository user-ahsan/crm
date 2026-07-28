'use client';

import { useState, useCallback, useEffect } from 'react';
import type { AutomationRule, AutomationRuleFormData, AutomationTriggerEvent } from '@/types/automation.types';
import { generateId } from '@/lib/formatters';
import { automationService } from '@/services/automation.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useAutomation() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useCurrentUser();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await automationService.getAll();
      setRules(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load automation rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await automationService.getAll();
        if (!cancelled) setRules(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load automation rules');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const createRule = useCallback(async (data: AutomationRuleFormData) => {
    const tempId = generateId();
    const optimisticItem = {
      id: tempId,
      ...data,
      description: data.description ?? '',
      enabled: data.enabled ?? true,
      createdBy: user?.id ?? '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as AutomationRule;
    setRules((prev) => [optimisticItem, ...prev]);
    try {
      const created = await automationService.create(data, user?.id ?? '');
      setRules((prev) => prev.map((r) => (r.id === tempId ? created : r)));
      return created;
    } catch (e) {
      setRules((prev) => prev.filter((r) => r.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to create rule');
      return undefined;
    }
  }, [user]);

  const updateRule = useCallback(async (id: string, data: Partial<AutomationRuleFormData>) => {
    let prevItem: AutomationRule | undefined;
    setRules((prev) => {
      prevItem = prev.find((r) => r.id === id);
      return prev.map((r) => (r.id === id ? { ...r, ...data } : r));
    });
    try {
      const updated = await automationService.update(id, data);
      if (updated) setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
      return updated;
    } catch (e) {
      if (prevItem) setRules((prev) => prev.map((r) => (r.id === id ? prevItem! : r)));
      setError(e instanceof Error ? e.message : 'Failed to update rule');
      return undefined;
    }
  }, []);

  const deleteRule = useCallback(async (id: string) => {
    let prevItem: AutomationRule | undefined;
    setRules((prev) => {
      prevItem = prev.find((r) => r.id === id);
      return prev.filter((r) => r.id !== id);
    });
    try {
      await automationService.delete(id);
      return true;
    } catch (e) {
      if (prevItem) setRules((prev) => [...prev, prevItem!]);
      setError(e instanceof Error ? e.message : 'Failed to delete rule');
      return false;
    }
  }, []);

  const getRulesByTrigger = useCallback(async (event: AutomationTriggerEvent) => {
    try {
      return await automationService.getByTrigger(event);
    } catch {
      return [];
    }
  }, []);

  return {
    rules,
    loading,
    error,
    refresh,
    createRule,
    updateRule,
    deleteRule,
    getRulesByTrigger,
  };
}
