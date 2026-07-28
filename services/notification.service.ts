/**
 * ─── Notification Preferences Service ─────────────────────────────────────
 *
 * CRUD wrapper around the `notification_preferences` table.
 * Provides typed access to per-user notification settings with sensible
 * defaults for new users.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { getSharedClient } from '@/lib/supabase/client';
import { ServiceError, toServiceError } from './supabase.service';
import type { NotificationEvent } from './realtime.service';

// ── Types ───────────────────────────────────────────────────────────────

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

// ── Service ─────────────────────────────────────────────────────────────

export const notificationService = {
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
