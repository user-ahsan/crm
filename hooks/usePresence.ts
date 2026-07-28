'use client';

import { useState, useEffect, useRef } from 'react';
import {
  trackPresence,
  onPresenceChange,
  isRealtimeEnabled,
  type PresenceUser,
} from '@/services/realtime.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// ── Types ───────────────────────────────────────────────────────────────

export interface PresenceReturn {
  /** Users currently viewing / tracking the same entity record. */
  onlineUsers: PresenceUser[];
  /** Whether presence tracking is active. */
  isTracking: boolean;
}

// ── Hook ────────────────────────────────────────────────────────────────

/**
 * Tracks real-time presence on a specific entity record.
 *
 * Automatically joins the presence channel when the component mounts
 * and leaves when it unmounts. Returns the list of currently-online users
 * so you can render avatar indicators in record detail pages.
 *
 * @param entityType — Entity type slug (e.g. 'lead', 'deal', 'task', 'meeting')
 * @param entityId   — The entity record's ID
 * @returns `{ onlineUsers, isTracking }`
 */
export function usePresence(entityType: string, entityId: string): PresenceReturn {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const { user } = useCurrentUser();
  const enabled = isRealtimeEnabled();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Guard: require all inputs
    if (!entityType || !entityId || !user?.id || !enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsTracking(false);
      setOnlineUsers([]);
      return;
    }

     
    setIsTracking(true);

    // Track our own presence on this record
    const unsubTrack = trackPresence(entityType, entityId, user.id, {
      name: user.fullName,
      avatarUrl: user.avatarUrl ?? undefined,
    });

    // Listen for presence changes
    const unsubPresence = onPresenceChange(entityType, entityId, {
      onSync: (users: PresenceUser[]) => {
        if (!mountedRef.current) return;
        setOnlineUsers(users);
      },
      onJoin: () => {
        // The sync event will also fire — setOnlineUsers in onSync
        // keeps the list accurate. onJoin is informational.
      },
      onLeave: () => {
        // Sync event handles the removal — this is informational.
      },
    });

    return () => {
      mountedRef.current = false;
      setIsTracking(false);
      setOnlineUsers([]);
      unsubTrack();
      unsubPresence();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, user?.id, enabled]); // user deep properties intentionally excluded

  return { onlineUsers, isTracking };
}
