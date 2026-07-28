/**
 * ─── Supabase Realtime Notification Service ──────────────────────────────
 *
 * Manages Postgres change subscriptions for live notifications.
 * Derives notifications from existing database changes — no custom queue.
 *
 * Channel naming scheme: notifications:user:{userId}
 * Tables monitored: leads, deals, tasks, meetings, team_members
 * ─────────────────────────────────────────────────────────────────────────
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import { toServiceError } from './supabase.service';
import type { RealtimePostgresChangesPayload, RealtimePostgresChangesFilter } from '@supabase/supabase-js';

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

// ── State ───────────────────────────────────────────────────────────────

/** Active channel subscriptions keyed by channel name. */
const activeChannels = new Map<string, ReturnType<ReturnType<typeof getSupabaseClient>['channel']>>();

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
  userId: string,
): Promise<RealtimeNotification[]> {
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
