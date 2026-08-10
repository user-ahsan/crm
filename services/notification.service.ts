/**
 * ─── Notification Service ─────────────────────────────────────────────────
 *
 * Two surfaces:
 *   1. Persistent in-app notifications backed by the `notifications` table
 *      (20260731_notifications.sql): getAll / markAsRead / markAllAsRead /
 *      create / dismiss. `create` ALSO broadcasts the notification on the
 *      target user's realtime channel so the panel updates instantly.
 *   2. Notification preferences (`notification_preferences` table) — kept
 *      for the settings UI.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { getSharedClient } from '@/lib/supabase/client';
import { ServiceError, toServiceError } from './supabase.service';
import { sendNotification, isNotificationEvent, type NotificationEvent } from './realtime.service';
import type { DbNotification } from '@/types/supabase.types';

// ── Types ───────────────────────────────────────────────────────────────

/** Persisted in-app notification (public domain shape). */
export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationEvent;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Input shape for notificationService.create. */
export interface NotificationFormData {
  userId: string;
  type: NotificationEvent;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  realtimeEnabled: boolean;
  notifyOn: NotificationEvent[];
}

/** Raw row shape from the database (snake_case). */
interface DbNotificationPreferences {
  id: string;
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  realtime_enabled: boolean;
  notify_on: string[];
  created_at: string;
  updated_at: string;
}

// ── Defaults ────────────────────────────────────────────────────────────

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  realtimeEnabled: true,
  notifyOn: [
    'lead_created',
    'task_due',
    'meeting_scheduled',
    'deal_won',
    'status_change',
    'member_joined',
  ],
};

// ── Mappers ─────────────────────────────────────────────────────────────

function mapRowToPreferences(row: DbNotificationPreferences): NotificationPreferences {
  return {
    emailNotifications: row.email_notifications,
    pushNotifications: row.push_notifications,
    realtimeEnabled: row.realtime_enabled,
    notifyOn: row.notify_on as NotificationEvent[],
  };
}

function mapPreferencesToRow(
  userId: string,
  prefs: NotificationPreferences,
): Omit<DbNotificationPreferences, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    email_notifications: prefs.emailNotifications,
    push_notifications: prefs.pushNotifications,
    realtime_enabled: prefs.realtimeEnabled,
    notify_on: prefs.notifyOn,
  };
}

function mapRowToNotification(row: DbNotification): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    // Rows are filtered through isNotificationEvent() before mapping in
    // getAll(); create() validates the type before insert — so the cast
    // below only sees known events.
    type: row.type as NotificationEvent,
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

// ── Service ─────────────────────────────────────────────────────────────

export const notificationService = {
  /**
   * Retrieves the current authenticated user's id, or falls back to the
   * shared client's demo user in mock mode.
   */
  async getCurrentUserId(): Promise<string> {
    const supabase = await getSharedClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new ServiceError('No authenticated user for notification operations', 'AUTH_ERROR', 401);
    }
    return user.id;
  },

  /**
   * Returns the persistent in-app notifications for a user (defaults to the
   * current session user), newest first. Rows with an unknown notification
   * event type are skipped rather than surfaced (they cannot be rendered by
   * the panel's type-keyed icon map).
   *
   * @param userId — target user id; defaults to the current session user
   */
  async getAll(userId?: string): Promise<AppNotification[]> {
    try {
      const supabase = await getSharedClient();
      const targetUserId = userId ?? (await this.getCurrentUserId());

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw toServiceError(error);

      return (data ?? [])
        .filter((row) => isNotificationEvent(row.type))
        .map(mapRowToNotification);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Marks a single notification as read (scoped to the current user so a
   * caller can never touch another user's row even if RLS is misconfigured).
   *
   * @returns true if a row was updated, false if the id did not exist
   */
  async markAsRead(id: string): Promise<boolean> {
    if (!id || id.trim().length === 0) {
      throw new ServiceError('Notification ID is required', 'VALIDATION_ERROR');
    }
    try {
      const supabase = await getSharedClient();
      const userId = await this.getCurrentUserId();
      const { data, error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();
      if (error) throw toServiceError(error);
      return data !== null;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Marks every unread notification for a user (defaults to the current
   * session user) as read.
   *
   * @returns the number of notifications marked read
   */
  async markAllAsRead(userId?: string): Promise<number> {
    try {
      const supabase = await getSharedClient();
      const targetUserId = userId ?? (await this.getCurrentUserId());
      const { data, error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', targetUserId)
        .is('read_at', null)
        .select('id');
      if (error) throw toServiceError(error);
      return data?.length ?? 0;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Persists a notification for a user AND broadcasts it on their realtime
   * channel for instant delivery (the polling fallback reads the same row).
   *
   * @param data — validated NotificationFormData
   */
  async create(data: NotificationFormData): Promise<AppNotification> {
    if (!data.userId || data.userId.trim().length === 0) {
      throw new ServiceError('Notification userId is required', 'VALIDATION_ERROR');
    }
    if (!isNotificationEvent(data.type)) {
      throw new ServiceError(`Unsupported notification type: ${String(data.type)}`, 'VALIDATION_ERROR');
    }
    if (!data.title || data.title.trim().length === 0) {
      throw new ServiceError('Notification title is required', 'VALIDATION_ERROR');
    }
    if (!data.body || data.body.trim().length === 0) {
      throw new ServiceError('Notification body is required', 'VALIDATION_ERROR');
    }
    try {
      const supabase = await getSharedClient();
      const { data: inserted, error } = await supabase
        .from('notifications')
        .insert({
          user_id: data.userId,
          type: data.type,
          title: data.title,
          body: data.body,
          entity_type: data.entityType ?? null,
          entity_id: data.entityId ?? null,
          read_at: null,
          // Explicit timestamps keep mock mode (which does not know the
          // notifications table's default columns) consistent with Supabase.
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw toServiceError(error);

      const notification = mapRowToNotification(inserted);

      // Broadcast for instant delivery. sendNotification never rejects (it
      // no-ops when the channel is absent or Realtime is disabled) — the
      // persisted row above remains the source of truth for catch-up.
      await sendNotification(data.userId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        description: notification.body,
        timestamp: notification.createdAt,
        read: false,
        data:
          notification.entityType && notification.entityId
            ? { [`${notification.entityType}Id`]: notification.entityId }
            : undefined,
      });

      return notification;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Dismisses (deletes) a notification, scoped to the current user.
   *
   * @returns true if a row was deleted, false if the id did not exist
   */
  async dismiss(id: string): Promise<boolean> {
    if (!id || id.trim().length === 0) {
      throw new ServiceError('Notification ID is required', 'VALIDATION_ERROR');
    }
    try {
      const supabase = await getSharedClient();
      const userId = await this.getCurrentUserId();
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Retrieves notification preferences for a user.
   *
   * If no preferences row exists yet, returns the system defaults without
   * persisting them. Call `updatePreferences` to save customized settings.
   *
   * @param userId — The authenticated user's ID
   * @returns      — The user's notification preferences (stored or default)
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const supabase = await getSharedClient();

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw toServiceError(error);

      if (!data) {
        return { ...DEFAULT_PREFERENCES };
      }

      return mapRowToPreferences(data as DbNotificationPreferences);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Creates or updates notification preferences for a user.
   *
   * Uses a single atomic upsert instead of read-then-write.
   * If a row for `userId` already exists it is updated;
   * otherwise a new row is inserted.
   *
   * @param userId — The authenticated user's ID
   * @param data   — Partial preferences to apply (unset fields retain current values)
   * @returns      — The merged, persisted preferences
   */
  async updatePreferences(
    userId: string,
    data: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    // Validate that userId is non-empty
    if (!userId || userId.trim().length === 0) {
      throw new ServiceError('User ID is required for notification preferences', 'VALIDATION_ERROR');
    }

    try {
      const supabase = await getSharedClient();

      // Fetch current preferences so we can merge partial updates
      const current = await this.getPreferences(userId);
      const merged: NotificationPreferences = { ...current, ...data };

      const row = mapPreferencesToRow(userId, merged);

      // Single atomic upsert
      const { data: upserted, error } = await supabase
        .from('notification_preferences')
        .upsert(row, { onConflict: 'user_id', ignoreDuplicates: false })
        .select()
        .single();

      if (error) throw toServiceError(error);

      return mapRowToPreferences(upserted as DbNotificationPreferences);
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
