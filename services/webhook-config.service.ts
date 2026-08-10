/**
 * ─── Webhook Config Service ────────────────────────────────────────────
 *
 * Service layer for managing webhook endpoint configurations stored in the
 * `webhook_configs` table. Provides CRUD operations and an event-based
 * lookup used by the webhook dispatcher.
 *
 * Usage:
 *   import { webhookConfigService } from '@/services/webhook-config.service';
 *
 *   const configs = await webhookConfigService.getActiveByEvent('lead.created');
 *   const record   = await webhookConfigService.create({ name: '...', url: '...' });
 *
 * All methods accept an optional Supabase client. Server route handlers
 * MUST pass their server client (`createServerSupabaseClient()`) so the
 * session resolves from request cookies; callers that omit it (webhook
 * dispatch in `webhook.service.ts`) fall back to the browser singleton.
 * RLS scopes rows to the authenticated user (created_by = auth.uid()).
 * ─────────────────────────────────────────────────────────────────────
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';
import { isPrivateHost } from '@/lib/ssrf';

// ── Types ─────────────────────────────────────────────────────────────

/**
 * Client used for DB access. Server route handlers MUST pass their
 * server client (`createServerSupabaseClient()`) so the session resolves
 * from request cookies; the browser fallback is retained only for
 * client-side webhook dispatch (`webhook.service.ts`), where the browser
 * singleton is the correct session source.
 */
type DbClient = SupabaseClient<Database>;

export interface WebhookConfigFormData {
  name: string;
  url: string;
  secret?: string;
  events?: string[];
  active?: boolean;
}

export interface WebhookConfigRecord {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[] | null;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Mapper ────────────────────────────────────────────────────────────

function mapRowToConfig(row: {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[] | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}): WebhookConfigRecord {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secret: row.secret ?? null,
    events: row.events ?? null,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Service ───────────────────────────────────────────────────────────

export const webhookConfigService = {
  /**
   * Returns all webhook configs visible to the current user (subject to RLS).
   * Ordered most-recent first.
   */
  async getAll(client?: DbClient): Promise<WebhookConfigRecord[]> {
    try {
      const supabase = client ?? getSupabaseClient();
      const { data, error } = await supabase
        .from('webhook_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw toServiceError(error);
      return (data ?? []).map(mapRowToConfig);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Returns a single webhook config by ID, or undefined when not found.
   */
  async getById(id: string, client?: DbClient): Promise<WebhookConfigRecord | undefined> {
    try {
      const supabase = client ?? getSupabaseClient();
      const { data, error } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        // PGRST116 = no rows returned — treat as "not found"
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data ? mapRowToConfig(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Creates a new webhook config. Automatically sets `created_by` to the
   * authenticated user. Defaults `active` to `true` when not provided.
   */
  async create(data: WebhookConfigFormData, client?: DbClient): Promise<WebhookConfigRecord> {
    try {
      const supabase = client ?? getSupabaseClient();
      const { data: userData } = await supabase.auth.getUser();

      try { new URL(data.url); } catch {
        throw new ServiceError(`Invalid webhook URL: ${data.url}`, 'INVALID_URL');
      }
      // SSRF protection: reject private/internal hosts
      if (isPrivateHost(data.url)) {
        throw new ServiceError(`Webhook URL must point to a public endpoint: ${data.url}`, 'INVALID_URL');
      }

      const dbRow: import('@/types/supabase.types').WebhookConfigInsert = {
        name: data.name,
        url: data.url,
        secret: data.secret ?? null,
        events: data.events ?? null,
        active: data.active ?? true,
        created_by: userData?.user?.id ?? 'system',
      };

      const { data: inserted, error } = await supabase
        .from('webhook_configs')
        .insert(dbRow)
        .select()
        .single();

      if (error) throw toServiceError(error);
      return mapRowToConfig(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Updates an existing webhook config. Only the provided fields are changed.
   * Returns the updated record, or `undefined` if the id does not exist.
   */
  async update(
    id: string,
    data: Partial<WebhookConfigFormData>,
    client?: DbClient,
  ): Promise<WebhookConfigRecord | undefined> {
    try {
      const supabase = client ?? getSupabaseClient();
      const dbRow: import('@/types/supabase.types').WebhookConfigUpdate = {};

      if (data.name !== undefined) dbRow.name = data.name;
      if (data.url !== undefined) {
        try { new URL(data.url); } catch {
          throw new ServiceError(`Invalid webhook URL: ${data.url}`, 'INVALID_URL');
        }
        // SSRF protection: reject private/internal hosts
        if (isPrivateHost(data.url)) {
          throw new ServiceError(`Webhook URL must point to a public endpoint: ${data.url}`, 'INVALID_URL');
        }
        dbRow.url = data.url;
      }
      if (data.secret !== undefined) dbRow.secret = data.secret || null;
      if (data.events !== undefined) dbRow.events = data.events;
      if (data.active !== undefined) dbRow.active = data.active;

      const { data: updated, error } = await supabase
        .from('webhook_configs')
        .update(dbRow)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return updated ? mapRowToConfig(updated) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Deletes a webhook config by ID. Returns `true` when the row was deleted,
   * throws if the row does not exist or the user lacks permission.
   */
  async delete(id: string, client?: DbClient): Promise<boolean> {
    try {
      const supabase = client ?? getSupabaseClient();
      const { error } = await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', id);

      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Returns all active webhook configs that subscribe to the given event.
   * Used by `webhook.service.ts` when dispatching events — sends the payload
   * to every matching endpoint in parallel.
   *
   * @param event - Event name such as 'lead.created' or 'task.overdue'
   */
  async getActiveByEvent(event: string, client?: DbClient): Promise<WebhookConfigRecord[]> {
    try {
      const supabase = client ?? getSupabaseClient();
      // contains() uses the Postgres @> array-contains operator
      const { data, error } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('active', true)
        .contains('events', [event]);

      if (error) throw toServiceError(error);
      return (data ?? []).map(mapRowToConfig);
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
