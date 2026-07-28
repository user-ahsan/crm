'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  startBroadcast,
  startListening,
  sendNotification,
  getPendingNotifications,
  isRealtimeEnabled,
  type RealtimeNotification,
  type BroadcastCallbacks,
} from '@/services/realtime.service';
import { toast } from 'sonner';

// ── Types ───────────────────────────────────────────────────────────────

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'loading';

export interface RealtimeNotificationsReturn {
  notifications: RealtimeNotification[];
  connectionStatus: ConnectionStatus;
  clearNotifications: () => void;
  markAsRead: (id: string) => void;
  unreadCount: number;
  /** Push a notification instantly to another user. */
  sendPush: (targetUserId: string, notification: RealtimeNotification) => Promise<void>;
}

// ── Deduplication helper ────────────────────────────────────────────────

/**
 * Returns true if `notif` has the same type and entity reference as any
 * notification already in the list (deduplicates broadcast + postgres_changes
 * delivering the same event).
 */
function isDuplicate(notif: RealtimeNotification, existing: RealtimeNotification[]): boolean {
  return existing.some((n) => {
    if (n.type !== notif.type) return false;
    // Compare entity references embedded in the data
    const refKeys = ['leadId', 'dealId', 'taskId', 'meetingId'] as const;
    for (const key of refKeys) {
      const a = n.data?.[key];
      const b = notif.data?.[key];
      if (a !== undefined && b !== undefined && a === b) return true;
    }
    return n.id === notif.id;
  });
}

// ── Hook ────────────────────────────────────────────────────────────────

/**
 * Hook that subscribes to real-time notifications using both broadcast
 * channels (instant push) and Postgres changes (persistence).
 *
 * @param userId — The authenticated user's ID
 * @returns `{ notifications, connectionStatus, clearNotifications, markAsRead, unreadCount, sendPush }`
 */
export function useRealtimeNotifications(userId: string): RealtimeNotificationsReturn {
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('loading');
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const enabled = isRealtimeEnabled();

  // ── Subscribe to broadcast + Postgres changes ──────────────

  useEffect(() => {
    if (!userId || !enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnectionStatus('disconnected');
      return;
    }

    mountedRef.current = true;
    setConnectionStatus('loading');

    let unsubBroadcast: (() => void) | null = null;
    let unsubChanges: (() => void) | null = null;

    const scheduleReconnect = () => {
      if (reconnectTimerRef.current) return;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!mountedRef.current) return;
        // Clean up old subscriptions
        unsubBroadcast?.();
        unsubChanges?.();
        // Re-create subscriptions
        setup();
      }, 2000);
    };

    const handleNotification = (notif: RealtimeNotification) => {
      if (!mountedRef.current) return;
      setNotifications((prev) => {
        if (isDuplicate(notif, prev)) return prev;
        return [notif, ...prev].slice(0, 200);
      });

      // Show a sonner toast for critical notification types
      if (['lead_created', 'deal_won', 'task_due', 'meeting_scheduled'].includes(notif.type)) {
        toast(notif.title, {
          description: notif.description,
        });
      }
    };

    const setup = () => {
      const broadcastCallbacks: BroadcastCallbacks = {
        onNotification: handleNotification,
        onStatusChange: (status: string) => {
          if (!mountedRef.current) return;
          switch (status) {
            case 'SUBSCRIBED':
              setConnectionStatus('connected');
              break;
            case 'CHANNEL_ERROR':
              setConnectionStatus('error');
              scheduleReconnect();
              break;
            case 'CLOSED':
              setConnectionStatus('disconnected');
              scheduleReconnect();
              break;
            case 'TIMED_OUT':
              // Transient — keep waiting
              break;
          }
        },
      };

      unsubBroadcast = startBroadcast(userId, broadcastCallbacks);
      unsubChanges = startListening(userId, { onNotification: handleNotification });
    };

    setup();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      unsubBroadcast?.();
      unsubChanges?.();
    };
  }, [userId, enabled]);

  // ── Poll fallback: catch up on missed notifications ────────

  useEffect(() => {
    if (!userId || !enabled) return;

    let cancelled = false;

    getPendingNotifications(userId)
      .then((pending) => {
        if (cancelled || pending.length === 0) return;
        setNotifications((prev) => {
          const existing = new Set(prev.map((n) => n.id));
          const newOnes = pending.filter((n) => !existing.has(n.id));
          return [...newOnes, ...prev].slice(0, 200);
        });
      })
      .catch(() => {
        // Silently fail — realtime will catch new ones going forward
      });

    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  // ── Periodic polling fallback ───────────────────────────────

  useEffect(() => {
    if (!userId || !enabled) return;
    let cancelled = false;

    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const pending = await getPendingNotifications(userId);
        if (cancelled || pending.length === 0) return;
        setNotifications((prev) => {
          const existing = new Set(prev.map((n) => n.id));
          const newOnes = pending.filter((n) => !existing.has(n.id));
          return [...newOnes, ...prev].slice(0, 200);
        });
      } catch {
        // Silently fail
      }
    }, 120000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId, enabled]);

  // ── Actions ─────────────────────────────────────────────────

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const sendPush = useCallback(
    async (targetUserId: string, notification: RealtimeNotification) => {
      if (!enabled) return;
      await sendNotification(targetUserId, notification);
    },
    [enabled],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    connectionStatus,
    clearNotifications,
    markAsRead,
    unreadCount,
    sendPush,
  };
}
