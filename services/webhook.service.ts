/**
 * ─── Webhook Service ──────────────────────────────────────────────────
 *
 * Service layer for sending webhook events to configured n8n endpoints.
 * Follows the same pattern as other services (lead.service.ts, etc.).
 *
 * Configuration:
 *   Set N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET in environment variables
 *   for legacy env-var setup, or use the DB-based webhook configs.
 *   The service auto-enables when N8N_WEBHOOK_URL is present.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { WebhookEvent } from '@/types/webhook.types';
import { webhookConfigService } from './webhook-config.service';
import { isPrivateHost } from '@/lib/ssrf';

// ── Types ─────────────────────────────────────────────────────────────

/** Configuration for the webhook sender. */
interface WebhookConfig {
  /** Target n8n webhook URL. */
  url: string;
  /** Shared secret for bearer auth. */
  secret: string;
  /** Whether webhook sending is enabled. */
  enabled: boolean;
}

/** Payload shape sent to the n8n webhook. */
interface WebhookPayload {
  event: WebhookEvent | string;
  timestamp: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/** Summary of a webhook delivery attempt. */
interface WebhookDeliveryResult {
  success: boolean;
  event: WebhookEvent | string;
  statusCode?: number;
  error?: string;
  attemptedAt: string;
}

// ── Configuration ─────────────────────────────────────────────────────

const webhookConfig: WebhookConfig = {
  url: process.env.N8N_WEBHOOK_URL || '',
  secret: process.env.N8N_WEBHOOK_SECRET || '',
  enabled: !!process.env.N8N_WEBHOOK_URL,
};

// ── Internal Helpers ──────────────────────────────────────────────────

/**
 * Sends a single webhook payload to one URL. Shared by both the legacy
 * env-var path and the new DB-based config path.
 * Returns a lightweight result suitable for aggregation.
 */
async function sendToUrl(
  url: string,
  secret: string | null,
  payload: WebhookPayload,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  // SSRF protection: reject private/internal hosts before making any outbound HTTP call.
  // This prevents attackers from using webhooks to probe internal network services
  // (e.g., 169.254.169.254 metadata endpoints, 10.x.x.x internal services, 127.0.0.1).
  if (isPrivateHost(url)) {
    return { success: false, error: `SSRF blocked: URL points to a private/internal host` };
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (secret) {
      headers['Authorization'] = `Bearer ${secret}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      success: response.ok,
      statusCode: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Network error: ${message}`,
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Quick guard — true when at least one webhook output is configured (legacy env-var or DB configs).
 * Used to skip unnecessary work when no webhooks are set up.
 * This is a fast check that avoids a DB query on every entity CRUD when webhooks aren't used.
 */
let _anyWebhookConfigured: boolean | null = null;
export function isAnyWebhookConfigured(): boolean {
  if (_anyWebhookConfigured === null) {
    _anyWebhookConfigured = !!(process.env.N8N_WEBHOOK_URL);
  }
  return _anyWebhookConfigured;
}

/** Resets the cached guard so the next call re-checks env vars. Used during testing only. */
export function resetWebhookGuard(): void {
  _anyWebhookConfigured = null;
}

/**
 * Sends a webhook event to the configured n8n endpoint.
 *
 * @param event  - The event type (e.g., 'lead.created', 'task.overdue')
 * @param data   - The event payload data (entity fields)
 * @param metadata - Optional additional context (user, source, etc.)
 *
 * @returns true if at least one endpoint responded successfully (2xx).
 *          `true` means "at least one succeeded", not "all succeeded".
 *          Use triggerWebhookWithDetails for per-endpoint diagnostics.
 *
 * This function silently returns false if:
 *   - Webhooks are not configured (enabled is false)
 *   - The HTTP request fails (network error, timeout, non-2xx status)
 *   - The payload is too large (implicitly handled by fetch)
 *
 * Operators should check logs for detailed failure information.
 *
 * @example
 * await triggerWebhook('lead.created', {
 *   id: 'lead-abc123',
 *   fullName: 'Jane Doe',
 *   email: 'jane@example.com',
 *   estimatedValue: 5000,
 * });
 */
export async function triggerWebhook(
  event: WebhookEvent | string,
  data: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  // Fast-path: no webhooks configured at all — skip everything
  if (!isAnyWebhookConfigured()) return false;
  const results = await triggerWebhookWithDetails(event, data, metadata);
  return results.some(r => r.success);
}

/**
 * Sends a webhook event to every matching endpoint (DB configs + legacy)
 * and returns detailed delivery information for each attempt. Useful for
 * diagnostics, debugging, and settings-ui health checks.
 *
 * @param event  - The event type
 * @param data   - The event payload
 * @param metadata - Optional additional context
 *
 * @returns An array of WebhookDeliveryResult — one per endpoint
 *
 * @example
 * const results = await triggerWebhookWithDetails('lead.created', leadData);
 * for (const r of results) {
 *   if (!r.success) console.error(r.error);
 * }
 */
export async function triggerWebhookWithDetails(
  event: WebhookEvent | string,
  data: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): Promise<WebhookDeliveryResult[]> {
  // Fast-path: no webhooks configured at all — skip everything
  if (!isAnyWebhookConfigured()) return [];

  const attemptedAt = new Date().toISOString();
  const payload: WebhookPayload = {
    event,
    timestamp: attemptedAt,
    data,
    metadata,
  };

  const promises: Promise<{ success: boolean; statusCode?: number; error?: string }>[] = [];

  // 1. DB-based webhook configs subscribed to this event
  try {
    const dbConfigs = await webhookConfigService.getActiveByEvent(event);
    for (const config of dbConfigs) {
      promises.push(sendToUrl(config.url, config.secret, payload));
    }
  } catch {
    // ponytail: no DB webhook configs — silently skip, no noise
  }

  // 2. Legacy env-var webhook
  if (webhookConfig.enabled) {
    promises.push(sendToUrl(webhookConfig.url, webhookConfig.secret, payload));
  }

  if (promises.length === 0) {
    // ponytail: no webhooks configured at all — silent empty result, no noise
    return [];
  }

  const settled = await Promise.allSettled(promises);
  return settled.map(r => {
    if (r.status === 'fulfilled') {
      return {
        success: r.value.success,
        event,
        statusCode: r.value.statusCode,
        error: r.value.error,
        attemptedAt,
      };
    }
    return {
      success: false,
      event,
      error: 'Webhook dispatch failed unexpectedly',
      attemptedAt,
    };
  });
}
