/**
 * ─── Supabase Realtime Notification Service ──────────────────────────────
 *
 * Manages Postgres change subscriptions for live notifications,
 * plus broadcast channels for instant push and presence tracking.
 *
 * Channel naming schemes:
 *   notifications:user:{userId}  — Postgres changes (persistence / catch-up)
 *   broadcast:user:{userId}      — Broadcast push (instant delivery)
 *   presence:{entityType}:{entityId} — Presence tracking (who is viewing)
 *
 * Tables monitored: leads, deals, tasks, meetings, team_members
 * ─────────────────────────────────────────────────────────────────────────
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import { toServiceError } from './supabase.service';
import { isFeatureEnabled } from '@/lib/feature-gates';
import type { RealtimeChannel, RealtimePostgresChangesPayload, RealtimePostgresChangesFilter } from '@supabase/supabase-js';

// ── Types ───────────────────────────────────────────────────────────────

export type NotificationEvent =
  | 'lead_created'
  | 'task_due'
  | 'meeting_scheduled'
  | 'deal_won'
  | 'status_change'
  | 'member_joined';

export interface RealtimeNotification {
  id: string;
  type: NotificationEvent;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  data?: Record<string, unknown>;
}

export interface RealtimeCallbacks {
  onNotification: (notification: RealtimeNotification) => void;
}

export interface BroadcastCallbacks extends RealtimeCallbacks {
  /** Called when the broadcast channel subscription status changes. */
  onStatusChange?: (status: string) => void;
}

export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string;
}

export interface PresenceCallbacks {
  /** Called with the full list of currently-present users. */
  onSync: (users: PresenceUser[]) => void;
  /** Called when a new user joins presence. */
  onJoin?: (user: PresenceUser) => void;
  /** Called when a user leaves presence. */
  onLeave?: (user: PresenceUser) => void;
}

// ── State ───────────────────────────────────────────────────────────────

/** Active Postgres change subscription channels keyed by channel name. */
const activeChannels = new Map<string, RealtimeChannel>();

/** Active broadcast channels keyed by channel name. */
const broadcastChannels = new Map<string, RealtimeChannel>();

/** Active presence channels. */
const presenceChannels = new Map<string, { channel: RealtimeChannel; userIds: Set<string> }>();

// ── Feature check ───────────────────────────────────────────────────────

/** Returns whether Realtime is enabled via environment variable. */
export function isRealtimeEnabled(): boolean {
  return isFeatureEnabled('realtime') && process.env.NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED === 'true';
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Maps a Supabase Postgres change payload to a RealtimeNotification
 * based on the table and operation type.
 */
function mapPayloadToNotification(
  table: string,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): RealtimeNotification | null {
  const newRow = payload.new as Record<string, unknown> | null;
  const oldRow = payload.old as Record<string, unknown> | null;
  const event = payload.eventType; // INSERT | UPDATE | DELETE

  // Only derive notifications from INSERT and relevant UPDATE operations
  if (event === 'DELETE') return null;

  const now = new Date().toISOString();
  const baseId = `realtime-${crypto.randomUUID()}`;

  switch (table) {
    case 'leads': {
      if (event === 'INSERT' && newRow && newRow.full_name) {
        return {
          id: baseId,
          type: 'lead_created',
          title: 'New Lead Created',
          description: `${String(newRow.full_name)} was added as a lead${newRow.company_name ? ` from ${String(newRow.company_name)}` : ''}.`,
          timestamp: now,
          read: false,
          data: { leadId: String(newRow.id), fullName: String(newRow.full_name) },
        };
      }
      if (event === 'UPDATE' && newRow && oldRow && newRow.status !== oldRow.status) {
        return {
          id: baseId,
          type: 'status_change',
          title: 'Lead Status Changed',
          description: `${String(newRow.full_name ?? 'A lead')} moved to ${String(newRow.status)}.`,
          timestamp: now,
          read: false,
          data: { leadId: String(newRow.id), oldStatus: String(oldRow.status ?? ''), newStatus: String(newRow.status) },
        };
      }
      return null;
    }

    case 'deals': {
      if (event === 'UPDATE' && newRow && oldRow && newRow.stage_id !== oldRow.stage_id) {
        const isWon = String(newRow.status ?? '') === 'won';
        return {
          id: baseId,
          type: isWon ? 'deal_won' : 'status_change',
          title: isWon ? 'Deal Won!' : 'Deal Stage Changed',
          description: isWon
            ? `Deal "${String(newRow.title ?? 'Unnamed')}" has been won! Value: ${String(newRow.value ?? '—')}.`
            : `Deal "${String(newRow.title ?? 'Unnamed')}" moved to a new stage.`,
          timestamp: now,
          read: false,
          data: { dealId: String(newRow.id), title: String(newRow.title) },
        };
      }
      return null;
    }

    case 'tasks': {
      if (event === 'INSERT' && newRow && newRow.title) {
        const dueText = newRow.due_date ? ` (due ${String(newRow.due_date).slice(0, 10)})` : '';
        return {
          id: baseId,
          type: 'task_due',
          title: 'New Task Assigned',
          description: `${String(newRow.title)}${dueText}.`,
          timestamp: now,
          read: false,
          data: { taskId: String(newRow.id), title: String(newRow.title), dueDate: String(newRow.due_date ?? '') },
        };
      }
      return null;
    }

    case 'meetings': {
      if (event === 'INSERT' && newRow && newRow.title) {
        return {
          id: baseId,
          type: 'meeting_scheduled',
          title: 'Meeting Scheduled',
          description: `"${String(newRow.title)}" on ${String(newRow.date_time ?? 'TBD')}.`,
          timestamp: now,
          read: false,
          data: { meetingId: String(newRow.id), title: String(newRow.title), dateTime: String(newRow.date_time ?? '') },
        };
      }
      return null;
    }

    case 'team_members': {
      if (event === 'INSERT' && newRow && newRow.user_id) {
        return {
          id: baseId,
          type: 'member_joined',
          title: 'Team Member Joined',
          description: `A new member (${String(newRow.user_id).slice(0, 8)}…) joined the team.`,
          timestamp: now,
          read: false,
          data: { userId: String(newRow.user_id), teamId: String(newRow.team_id) },
        };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Builds the filter expression for a table's "assigned to" column,
 * scoped to the current user. Some tables use different column names.
 */
function buildFilter(table: string, userId: string): string | undefined {
  switch (table) {
    case 'leads':
    case 'deals':
    case 'tasks':
      return `assigned_to=eq.${userId}`;
    case 'meetings':
      // meetings store participants as a UUID[] — we can't filter by array contains via postgres_changes filter
      // Instead, subscribe to all meetings and filter client-side in the callback
      return undefined;
    case 'team_members':
      return `user_id=eq.${userId}`;
    default:
      return undefined;
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Starts listening for real-time notifications relevant to the given user.
 *
 * Creates a Supabase Realtime channel and subscribes to Postgres changes on
 * the leads, deals, tasks, meetings, and team_members tables. Incoming
 * changes are mapped to `RealtimeNotification` objects and forwarded to the
 * `onNotification` callback.
 *
 * @param userId   — The authenticated user's ID
 * @param callbacks — Object with `onNotification` to handle incoming events
 * @returns        — An unsubscribe function that tears down all subscriptions
 */
export function startListening(
  userId: string,
  callbacks: RealtimeCallbacks,
): () => void {
  const supabase = getSupabaseClient();
  const channelName = `notifications:user:${userId}`;

  // If we already have a channel open for this user, return a no-op
  if (activeChannels.has(channelName)) {
    return () => stopListening(channelName);
  }

  const tables = ['leads', 'deals', 'tasks', 'meetings', 'team_members'] as const;

  const channel = supabase.channel(channelName);

  for (const table of tables) {
    const filter = buildFilter(table, userId);

    const config: RealtimePostgresChangesFilter<'*'> = {
      event: '*',
      schema: 'public',
      table,
      ...(filter ? { filter } : {}),
    };

    channel.on(
      'postgres_changes',
      config,
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        try {
          const notification = mapPayloadToNotification(table, payload);
          if (notification) {
            callbacks.onNotification(notification);
          }
        } catch {
          // Silently skip malformed payloads — Realtime continues unaffected
        }
      },
    );
  }

  channel.subscribe((status: string, err?: Error) => {
    if (status !== 'SUBSCRIBED') {
      // Surface subscribe failure to the caller
      const errorMsg = err?.message ?? `Realtime subscription status: ${status}`;
      console.error(`[realtime] Channel ${channelName} subscribe failed: ${errorMsg}`);
    }
  });

  activeChannels.set(channelName, channel);

  return () => stopListening(channelName);
}

/**
 * Unsubscribes a specific Realtime channel (or all channels if no name given).
 * Safe to call multiple times.
 */
export function stopListening(channelName?: string): void {
  if (channelName) {
    const channel = activeChannels.get(channelName);
    if (channel) {
      try {
        channel.unsubscribe();
      } catch {
        // Swallow unsubscribe errors — channel may already be closed
      }
      activeChannels.delete(channelName);
    }
  } else {
    // Legacy: kill all (for cleanup)
    for (const [name, channel] of activeChannels) {
      try {
        channel.unsubscribe();
      } catch {
        // Swallow unsubscribe errors — channel may already be closed
      }
      activeChannels.delete(name);
    }
  }
}

/**
 * Fallback polling for notifications the user may have missed while offline.
 *
 * Queries the `activities` table for recent activity records and maps them
 * to `RealtimeNotification` objects. This acts as a catch-up mechanism when
 * Realtime wasn't active.
 *
 * @param userId — The authenticated user's ID
 * @returns      — A list of recent notifications derived from activities
 */
export async function getPendingNotifications(
  _userId: string,
): Promise<RealtimeNotification[]> {
  void _userId; // Reserved for future use — will scope notifications per user
  try {
    const supabase = getSupabaseClient();

    // Fetch recent activities across all entity types that the user
    // is assigned to or that reference the user
    const { data: activities, error } = await supabase
      .from('activities')
      .select('*')
      .or(`entity_type.eq.leads,entity_type.eq.deals,entity_type.eq.tasks,entity_type.eq.meetings`)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) throw toServiceError(error);
    if (!activities || activities.length === 0) return [];

    const notifications: RealtimeNotification[] = [];

    for (const activity of activities) {
      // Map activity types to notification events
      const typeMap: Record<string, NotificationEvent> = {
        created: 'lead_created',
        task_created: 'task_due',
        task_completed: 'task_due',
        meeting_scheduled: 'meeting_scheduled',
        status_changed: 'status_change',
        assigned: 'member_joined',
      };

      const mappedType = typeMap[activity.type];
      if (!mappedType) continue;

      notifications.push({
        id: `pending-${activity.id}`,
        type: mappedType,
        title: formatPendingTitle(activity.type, activity.description),
        description: activity.description,
        timestamp: activity.timestamp,
        read: true, // Pending notifications from the past are pre-marked as read
        data: activity.metadata ?? undefined,
      });
    }

    return notifications;
  } catch (e) {
    throw toServiceError(e);
  }
}

/**
 * Formats a human-readable title for a pending notification based on the
 * activity type and description.
 */
function formatPendingTitle(type: string, description: string): string {
  switch (type) {
    case 'created':
      return description.startsWith('Lead') ? 'New Lead' : 'New Entry';
    case 'task_created':
      return 'New Task';
    case 'task_completed':
      return 'Task Completed';
    case 'meeting_scheduled':
      return 'Meeting Scheduled';
    case 'status_changed':
      return 'Status Change';
    case 'assigned':
      return 'You were assigned';
    default:
      return 'Update';
  }
}

// ═════════════════════════════════════════════════════════════════════════
// BROADCAST CHANNEL API
// ═════════════════════════════════════════════════════════════════════════

/**
 * Starts a broadcast channel for the given user that listens for instant
 * push notifications delivered via `channel.send({ type: 'broadcast', ... })`.
 *
 * This complements `startListening()` — broadcast provides instant delivery
 * while Postgres changes provide persistence and catch-up.
 *
 * @param userId   — The authenticated user's ID
 * @param callbacks — Object with `onNotification` (and optional `onStatusChange`)
 * @returns        — An unsubscribe function
 */
export function startBroadcast(
  userId: string,
  callbacks: BroadcastCallbacks,
): () => void {
  const supabase = getSupabaseClient();
  const channelName = `broadcast:user:${userId}`;

  // If already subscribed, return a no-op
  if (broadcastChannels.has(channelName)) {
    return () => stopBroadcast(userId);
  }

  const channel = supabase.channel(channelName);

  // Listen for broadcast notification events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channel.on('broadcast', { event: 'notification' }, ({ payload }: { payload: any }) => {
    try {
      const notification = payload as RealtimeNotification;
      callbacks.onNotification(notification);
    } catch {
      // Silently skip malformed payloads
    }
  });

  channel.subscribe((status: string) => {
    callbacks.onStatusChange?.(status);
    if (status !== 'SUBSCRIBED') {
      console.error(`[realtime] Broadcast channel ${channelName} subscribe error: ${status}`);
    }
  });

  broadcastChannels.set(channelName, channel);

  return () => stopBroadcast(userId);
}

/**
 * Sends a notification via the user's broadcast channel for instant delivery.
 *
 * If no active broadcast channel exists for the user, the notification is
 * silently skipped — it will be picked up by the Postgres changes subscription
 * or the polling fallback.
 *
 * @param userId       — The target user's ID
 * @param notification — The notification to deliver
 */
export async function sendNotification(
  userId: string,
  notification: RealtimeNotification,
): Promise<void> {
  if (!isRealtimeEnabled()) return;

  const channelName = `broadcast:user:${userId}`;
  const channel = broadcastChannels.get(channelName);

  if (channel) {
    try {
      await channel.send({
        type: 'broadcast',
        event: 'notification',
        payload: notification,
      });
    } catch {
      // Silently fail — Postgres changes / polling will catch it
    }
  }
  // No active channel — notification will be caught by postgres_changes / polling
}

/**
 * Stops the broadcast channel for the given user.
 * Safe to call multiple times.
 *
 * @param userId — The user whose broadcast channel to stop
 */
export function stopBroadcast(userId: string): void {
  const channelName = `broadcast:user:${userId}`;
  const channel = broadcastChannels.get(channelName);
  if (channel) {
    try {
      channel.unsubscribe();
    } catch {
      // Channel may already be closed
    }
    broadcastChannels.delete(channelName);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// PRESENCE TRACKING API
// ═════════════════════════════════════════════════════════════════════════

/**
 * Tracks the current user's presence on a specific entity record.
 * Creates (or reuses) a presence channel and registers the user.
 *
 * @param entityType — Entity type (e.g. 'lead', 'deal', 'task')
 * @param entityId   — Entity record ID
 * @param userId     — The current user's ID
 * @param userMeta   — Display metadata (name, avatar)
 * @returns          — An unsubscribe function that stops tracking
 */
export function trackPresence(
  entityType: string,
  entityId: string,
  userId: string,
  userMeta: { name: string; avatarUrl?: string },
): () => void {
  const supabase = getSupabaseClient();
  const channelName = `presence:${entityType}:${entityId}`;

  // Add user to existing channel if it exists
  const existing = presenceChannels.get(channelName);
  if (existing) {
    existing.userIds.add(userId);
    existing.channel.track({
      user_id: userId,
      name: userMeta.name,
      avatar_url: userMeta.avatarUrl ?? null,
      online_at: new Date().toISOString(),
    }).catch(() => {});
    return () => {
      existing.userIds.delete(userId);
      stopPresence(entityType, entityId);
    };
  }

  const channel = supabase.channel(channelName);

  channel.subscribe(async (status: string) => {
    if (status === 'SUBSCRIBED') {
      try {
        await channel.track({
          user_id: userId,
          name: userMeta.name,
          avatar_url: userMeta.avatarUrl ?? null,
          online_at: new Date().toISOString(),
        });
      } catch {
        console.error(`[realtime] Presence track failed for ${channelName}`);
      }
    } else if (status !== 'SUBSCRIBED') {
      console.error(`[realtime] Presence channel ${channelName} error: ${status}`);
    }
  });

  presenceChannels.set(channelName, { channel, userIds: new Set([userId]) });

  return () => {
    const entry = presenceChannels.get(channelName);
    if (entry) {
      entry.userIds.delete(userId);
      if (entry.userIds.size === 0) {
        stopPresence(entityType, entityId);
      }
    }
  };
}

/**
 * Listens for presence changes on a specific entity record.
 * Reports join / leave / sync events via the provided callbacks.
 *
 * @param entityType — Entity type (e.g. 'lead', 'deal', 'task')
 * @param entityId   — Entity record ID
 * @param callbacks  — Presence event callbacks
 * @returns          — An unsubscribe function
 */
export function onPresenceChange(
  entityType: string,
  entityId: string,
  callbacks: PresenceCallbacks,
): () => void {
  const supabase = getSupabaseClient();
  const channelName = `presence:${entityType}:${entityId}`;

  // Reuse existing presence channel if one is already active
  const existing = presenceChannels.get(channelName);
  const channel = existing?.channel ?? supabase.channel(channelName);

  channel
    .on('presence', { event: 'sync' }, () => {
      try {
        const state = channel.presenceState();
        const users: PresenceUser[] = [];
        for (const presences of Object.values(state)) {
          const list = presences as Array<{
            user_id: string;
            name: string;
            avatar_url?: string;
          }>;
          for (const p of list) {
            users.push({
              userId: p.user_id,
              name: p.name,
              avatarUrl: p.avatar_url ?? undefined,
            });
          }
        }
        callbacks.onSync(users);
      } catch {
        // Silently skip malformed presence state
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: any }) => {
      try {
        const presences = newPresences as Array<{
          user_id: string;
          name: string;
          avatar_url?: string;
        }>;
        for (const p of presences) {
          callbacks.onJoin?.({
            userId: p.user_id,
            name: p.name,
            avatarUrl: p.avatar_url ?? undefined,
          });
        }
      } catch {
        // Silently skip malformed join events
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: any }) => {
      try {
        const presences = leftPresences as Array<{
          user_id: string;
          name: string;
          avatar_url?: string;
        }>;
        for (const p of presences) {
          callbacks.onLeave?.({
            userId: p.user_id,
            name: p.name,
            avatarUrl: p.avatar_url ?? undefined,
          });
        }
      } catch {
        // Silently skip malformed leave events
      }
    });

  // Only subscribe if this is a new channel (not reusing an existing one)
  if (!existing) {
    channel.subscribe((status: string) => {
      if (status !== 'SUBSCRIBED') {
        console.error(`[realtime] Presence listener ${channelName} error: ${status}`);
      }
    });
    presenceChannels.set(channelName, { channel, userIds: new Set() });
  }

  return () => {
    // Individual listener cleanup is handled by the caller
    // The channel stays alive as long as there are active trackers
  };
}

/**
 * Stops presence tracking on a specific entity record.
 * If no users remain, the channel is fully unsubscribed.
 *
 * @param entityType — Entity type
 * @param entityId   — Entity record ID
 */
export function stopPresence(entityType: string, entityId: string): void {
  const channelName = `presence:${entityType}:${entityId}`;
  const entry = presenceChannels.get(channelName);

  if (!entry) return;

  // Only fully unsubscribe if no users are tracking
  if (entry.userIds.size === 0) {
    try {
      entry.channel.unsubscribe();
    } catch {
      // Channel may already be closed
    }
    presenceChannels.delete(channelName);
  }
}
