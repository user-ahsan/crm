'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { SmsLog, SmsFormData, SmsDirection } from '@/types/sms.types';
import { generateId } from '@/lib/formatters';
import { smsService, isSmsRelatedEntity } from '@/services/sms.service';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const DEFAULT_SMS_FROM = process.env.NEXT_PUBLIC_DEFAULT_SMS_FROM ?? '+15551234567';

/**
 * Validates an untrusted API response row into a typed SmsLog. Returns null
 * when the payload is not a persisted SMS log (no unsafe casts of network data).
 */
function parseSmsLog(value: unknown): SmsLog | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const str = (key: string): string => (typeof row[key] === 'string' ? (row[key] as string) : '');
  const id = str('id');
  const toNumber = str('toNumber');
  if (!id || !toNumber) return null;
  const status: SmsLog['status'] =
    row.status === 'queued' || row.status === 'sent' || row.status === 'delivered' || row.status === 'failed'
      ? row.status
      : 'queued';
  const direction: SmsDirection =
    row.direction === 'inbound' || row.direction === 'outbound' ? row.direction : 'outbound';
  return {
    id,
    toNumber,
    fromNumber: str('fromNumber'),
    body: str('body'),
    direction,
    status,
    providerMessageId: str('providerMessageId') || undefined,
    errorMessage: str('errorMessage') || undefined,
    relatedToType: isSmsRelatedEntity(row.relatedToType) ? row.relatedToType : undefined,
    relatedToId: str('relatedToId') || undefined,
    createdBy: str('createdBy') || 'system',
    createdAt: str('createdAt') || new Date().toISOString(),
  };
}

/**
 * Real-send path: POSTs to /api/sms/send (auth + CSRF + rate limit handled
 * server-side; the route persists the log AND reconciles provider status).
 * Resolves with the server row so provider_message_id + real status come back.
 */
async function sendSmsViaApi(data: SmsFormData): Promise<SmsLog> {
  const res = await fetch('/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toNumber: data.toNumber,
      body: data.body,
      fromNumber: data.fromNumber,
      relatedToType: data.relatedToType,
      relatedToId: data.relatedToId,
    }),
  });

  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error('Failed to send SMS');
  }

  // The route always persists a row (queued/failed included) — reconcile with
  // the server row when present; only throw when nothing was persisted.
  const persisted = parseSmsLog(body.sms);
  if (persisted) return persisted;

  const message = typeof body.error === 'string' && body.error.trim() ? body.error.trim() : 'Failed to send SMS';
  throw new Error(message);
}

export function useSms(entityType?: string, entityId?: string) {
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useCurrentUser();

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

  const sendSms = useCallback(async (data: SmsFormData): Promise<SmsLog | undefined> => {
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
      createdBy: currentUser?.id ?? 'system',
      createdAt: new Date().toISOString(),
    };
    setSmsLogs((prev) => [optimisticItem, ...prev]);
    try {
      // Real path: POST /api/sms/send (Twilio + DB persistence). Mock env
      // (no Supabase): fall back to the documented simulated path — the
      // service persists locally; with no Twilio creds it records 'queued'
      // with the provider-not-configured signal, matching the old mock UX.
      const created = isSupabaseConfigured()
        ? await sendSmsViaApi(data)
        : await smsService.send(data);
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
  }, [currentUser?.id]);

  const sendTestSms = useCallback(async (toNumber: string, body?: string) => {
    return sendSms({
      toNumber,
      body: body ?? 'This is a test SMS from the CRM system.',
      relatedToType: isSmsRelatedEntity(entityType) ? entityType : undefined,
      relatedToId: entityId,
    });
  }, [sendSms, entityType, entityId]);

  return { smsLogs, loading, error, refresh, sendSms, sendTestSms };
}
