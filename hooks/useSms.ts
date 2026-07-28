'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { SmsLog, SmsFormData } from '@/types/sms.types';
import { generateId } from '@/lib/formatters';
import { smsService } from '@/services/sms.service';

const DEFAULT_SMS_FROM = process.env.NEXT_PUBLIC_DEFAULT_SMS_FROM ?? '+15551234567';

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
    const tempId = generateId();
    const optimisticItem: SmsLog = {
      id: tempId,
      toNumber: data.toNumber,
      fromNumber: data.fromNumber ?? DEFAULT_SMS_FROM,
      body: data.body,
      direction: 'outbound',
      status: 'sent',
      relatedToType: data.relatedToType,
      relatedToId: data.relatedToId,
      createdBy: 'system',
      createdAt: new Date().toISOString(),
    };
    setSmsLogs((prev) => [optimisticItem, ...prev]);
    try {
      const created = await smsService.send(data);
      setSmsLogs((prev) => prev.map((s) => (s.id === tempId ? created : s)));
      if (created.status === 'queued') {
        toast.warning('SMS queued', {
          description: created.errorMessage ?? 'SMS provider not configured.',
        });
      } else if (created.status === 'failed') {
        toast.error('SMS failed to send', {
          description: created.errorMessage ?? 'Unknown error',
        });
      } else if (created.providerMessageId) {
        toast.success('SMS sent successfully', {
          description: `Message ID: ${created.providerMessageId}`,
        });
      } else {
        toast.success('SMS sent successfully');
      }
      return created;
    } catch (e) {
      setSmsLogs((prev) => prev.filter((s) => s.id !== tempId));
      const msg = e instanceof Error ? e.message : 'Failed to send SMS';
      setError(msg);
      toast.error('Failed to send SMS', { description: msg });
      return undefined;
    }
  }, []);

  const sendTestSms = useCallback(async (toNumber: string, body?: string) => {
    return sendSms({
      toNumber,
      body: body ?? 'This is a test SMS from the CRM system.',
      relatedToType: entityType as SmsFormData['relatedToType'],
      relatedToId: entityId,
    });
  }, [sendSms, entityType, entityId]);

  return { smsLogs, loading, error, refresh, sendSms, sendTestSms };
}
