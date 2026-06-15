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

  const connect = async (data: CalendarIntegrationFormData) => {
    const integration = await integrationService.connectCalendar(data);
    setIntegrations((prev) => [integration, ...prev]);
  };

  const disconnect = async (id: string) => {
    await integrationService.disconnect(id);
    setIntegrations((prev) => prev.filter((i) => i.id !== id));
  };

  const toggleSync = async (id: string, enabled: boolean) => {
    await integrationService.toggleSync(id, enabled);
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, syncEnabled: enabled } : i)),
    );
  };

  return { integrations, loading, error, reload: load, connect, disconnect, toggleSync };
}
