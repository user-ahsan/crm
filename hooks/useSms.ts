'use client';

import { useState, useCallback, useEffect } from 'react';
import type { SmsLog, SmsFormData } from '@/types/sms.types';
import { smsService } from '@/services/sms.service';

export function useSms(entityType?: string, entityId?: string) {
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await smsService.getLogs(entityType, entityId);
      setSmsLogs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load SMS logs');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (!entityType || !entityId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await smsService.getLogs(entityType, entityId);
        if (!cancelled) setSmsLogs(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load SMS logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  const sendSms = useCallback(async (data: SmsFormData) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: SmsLog = {
      id: tempId,
      toNumber: data.toNumber,
      fromNumber: data.fromNumber ?? '+15551234567',
      body: data.body,
      direction: 'outbound',
      status: 'sent',
      relatedToType: data.relatedToType,
      relatedToId: data.relatedToId,
      createdBy: 'current-user',
      createdAt: new Date().toISOString(),
    };
    setSmsLogs((prev) => [optimisticItem, ...prev]);
    try {
      const created = await smsService.send(data);
      setSmsLogs((prev) => prev.map((s) => (s.id === tempId ? created : s)));
      return created;
    } catch (e) {
      setSmsLogs((prev) => prev.filter((s) => s.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to send SMS');
      return undefined;
    }
  }, []);

  return { smsLogs, loading, error, refresh, sendSms };
}
