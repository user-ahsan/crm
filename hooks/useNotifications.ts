'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { startListening, getPendingNotifications, type RealtimeNotification } from '@/services/realtime.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  type: 'lead_created' | 'meeting_scheduled' | 'task_due' | 'deal_won' | 'status_change' | 'member_joined';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  data?: Record<string, unknown>;
}

/**
 * Returns true if `notif` duplicates an entry already in the list — same type
 * AND same entity reference (any of the entity id fields) or same id. This is
 * the richer check shared with useRealtimeNotifications: two distinct events
 * on the same lead (e.g. two status changes) are NOT collapsed, while the
 * same event delivered twice (broadcast + postgres_changes) is.
 */
function isDuplicate(notif: RealtimeNotification, existing: Notification[]): boolean {
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

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useCurrentUser();
  const initialisedRef = useRef(false);

  // Subscribe to Supabase Realtime when user is available
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = startListening(user.id, {
      onNotification: (realtimeNotif: RealtimeNotification) => {
        setNotifications((prev) => {
          // Dedup against all entity refs (see isDuplicate above)
          if (isDuplicate(realtimeNotif, prev)) return prev;

          const notif: Notification = {
            id: realtimeNotif.id,
            type: realtimeNotif.type,
            title: realtimeNotif.title,
            description: realtimeNotif.description,
            timestamp: realtimeNotif.timestamp,
            read: false,
            data: realtimeNotif.data,
          };
          return [notif, ...prev].slice(0, 200);
        });

        // Show a sonner toast for critical notification types
        if (['lead_created', 'deal_won', 'task_due'].includes(realtimeNotif.type)) {
          toast(realtimeNotif.title, {
            description: realtimeNotif.description,
          });
        }
      },
    });

    return () => {
      unsubscribe();
      initialisedRef.current = false;
    };
  }, [user?.id]);

  // Poll fallback: fetch missed notifications on mount
  useEffect(() => {
    if (!user?.id || initialisedRef.current) return;
    initialisedRef.current = true;

    getPendingNotifications(user.id)
      .then((pending) => {
        if (pending.length > 0) {
          setNotifications(prev => [...pending.slice(0, 200), ...prev.filter(n => !pending.some(p => p.id === n.id))].slice(0, 200));
        }
      })
      .catch(() => {
        // Silently fail — Realtime will catch new notifications going forward
      });
  }, [user?.id]);

  // Fallback polling every 2 minutes for missed notifications
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const pending = await getPendingNotifications(user.id);
        if (cancelled) return;
        if (pending.length > 0) {
          setNotifications(prev => {
            const existing = new Set(prev.map(n => n.id));
            const newOnes = pending.filter(n => !existing.has(n.id));
            return [...newOnes, ...prev].slice(0, 200);
          });
        }
      } catch {} // silent poll
    }, 120000);
    return () => { clearInterval(interval); cancelled = true; };
  }, [user?.id]);

  // ── Local state helpers (same interface as before) ──────────

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: Notification = {
      ...notif,
      id: `notif-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    dismissNotification,
  };
}
