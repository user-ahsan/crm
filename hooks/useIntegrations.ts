'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CalendarIntegration, CalendarIntegrationFormData } from '@/types/integration.types';
import { integrationService } from '@/services/integration.service';

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await integrationService.getCalendarIntegrations();
      setIntegrations(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    integrationService.getCalendarIntegrations()
      .then((data) => {
        if (!cancelled) setIntegrations(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load integrations');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const connect = useCallback(async (data: CalendarIntegrationFormData) => {
    try {
      const integration = await integrationService.connectCalendar(data);
      setIntegrations((prev) => [integration, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect integration');
    }
  }, []);

  const disconnect = useCallback(async (id: string): Promise<boolean> => {
    const prev = integrations;
    setIntegrations(current => current.filter(i => i.id !== id));
    try {
      const result = await integrationService.disconnect(id);
      if (!result) {
        setIntegrations(prev);
        return false;
      }
      return true;
    } catch (e) {
      setIntegrations(prev);
      setError(e instanceof Error ? e.message : 'Failed to disconnect integration');
      throw e;
    }
  }, [integrations]);

  const toggleSync = useCallback(async (id: string, enabled: boolean) => {
    const prev = integrations;
    setIntegrations(current =>
      current.map(i => (i.id === id ? { ...i, syncEnabled: enabled } : i)),
    );
    try {
      await integrationService.toggleSync(id, enabled);
    } catch (e) {
      setIntegrations(prev);
      setError(e instanceof Error ? e.message : 'Failed to toggle sync');
    }
  }, [integrations]);

  return { integrations, loading, error, reload: load, connect, disconnect, toggleSync };
}
