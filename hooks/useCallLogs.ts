'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CallLog, CallLogFormData } from '@/types/communication.types';
import { generateId } from '@/lib/formatters';
import { communicationService } from '@/services/communication.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useCallLogs(entityType?: string, entityId?: string) {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useCurrentUser();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await communicationService.getCallLogs(entityType, entityId);
      setCallLogs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load call logs');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await communicationService.getCallLogs(entityType, entityId);
        if (!cancelled) setCallLogs(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load call logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  const logCall = useCallback(async (data: CallLogFormData) => {
    const tempId = generateId();
    const optimisticItem: CallLog = {
      id: tempId,
      direction: data.direction,
      duration: data.duration ?? 0,
      caller: data.caller,
      callee: data.callee,
      notes: data.notes ?? '',
      callResult: data.callResult ?? 'completed',
      relatedToType: data.relatedToType,
      relatedToId: data.relatedToId,
      createdBy: user?.id ?? 'system',
      createdAt: new Date().toISOString(),
    };
    setCallLogs((prev) => [optimisticItem, ...prev]);
    try {
      const created = await communicationService.logCall(data);
      setCallLogs((prev) => prev.map((c) => (c.id === tempId ? created : c)));
      return created;
    } catch (e) {
      setCallLogs((prev) => prev.filter((c) => c.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to log call');
      return undefined;
    }
  }, [user?.id]);

  return { callLogs, loading, error, logCall, refresh };
}
