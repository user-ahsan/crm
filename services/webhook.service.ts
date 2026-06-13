/**
 * ─── Webhook Service ──────────────────────────────────────────────────
 *
 * Service layer for sending webhook events to configured n8n endpoints.
 * Follows the same pattern as other services (lead.service.ts, etc.):
 * singleton object export, async methods, dual-mode operation.
 *
 * Usage:
 *   import { isWebhookEnabled, triggerWebhook } from '@/services/webhook.service';
 *
 *   if (isWebhookEnabled()) {
 *     triggerWebhook('lead.created', { id: lead.id, fullName: lead.fullName });
 *   }
 *
 * Configuration:
 *   Set N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET in environment variables.
 *   The service auto-enables when N8N_WEBHOOK_URL is present.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { WebhookEvent } from '@/app/api/webhook/n8n/route';

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

let webhookConfig: WebhookConfig = {
  url: process.env.N8N_WEBHOOK_URL || '',
  secret: process.env.N8N_WEBHOOK_SECRET || '',
  enabled: !!process.env.N8N_WEBHOOK_URL,
};

// ── Public API ────────────────────────────────────────────────────────

/**
 * Updates the webhook configuration at runtime. Merges provided values
 * into the existing config. Automatically derives the `enabled` flag
 * from whether a URL has been set.
 *
 * @param config - Partial configuration to apply
 *
 * @example
 * configureWebhooks({ url: 'https://n8n.example.com/webhook/crm' });
 */
export function configureWebhooks(config: Partial<WebhookConfig>): void {
  webhookConfig = { ...webhookConfig, ...config };
  webhookConfig.enabled = !!webhookConfig.url;
}

/**
 * Returns whether the webhook service is currently enabled and ready
 * to send events. The service is enabled when `N8N_WEBHOOK_URL` is set.
 */
export function isWebhookEnabled(): boolean {
  return webhookConfig.enabled;
}

/**
 * Returns the current webhook configuration (read-only snapshot).
 * Useful for displaying connection status in settings UI.
 */
export function getWebhookConfig(): Readonly<WebhookConfig> {
  return { ...webhookConfig };
}

/**
 * Sends a webhook event to the configured n8n endpoint.
 *
 * @param event  - The event type (e.g., 'lead.created', 'task.overdue')
 * @param data   - The event payload data (entity fields)
 * @param metadata - Optional additional context (user, source, etc.)
 *
 * @returns true if the webhook was sent and received successfully (2xx)
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
  if (!webhookConfig.enabled) {
    return false;
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
    metadata,
  };

  try {
    const controller = new AbortController();
    // Timeout after 10 seconds to prevent hanging
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${webhookConfig.secret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[Webhook] Delivery failed for ${event}: HTTP ${response.status} ${response.statusText}`,
      );
      return false;
    }

    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Webhook] Failed to send event ${event}:`, message);
    return false;
  }
}

/**
 * Sends a webhook event and returns detailed delivery information,
 * including HTTP status code and any error message. Useful for
 * diagnostics, debugging, and settings-ui health checks.
 *
 * @param event  - The event type
 * @param data   - The event payload
 * @param metadata - Optional additional context
 *
 * @returns A WebhookDeliveryResult with success/failure details
 *
 * @example
 * const result = await triggerWebhookWithDetails('lead.created', leadData);
 * if (!result.success) {
 *   showToast(`Webhook failed: ${result.error}`);
 * }
 */
export async function triggerWebhookWithDetails(
  event: WebhookEvent | string,
  data: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): Promise<WebhookDeliveryResult> {
  const attemptedAt = new Date().toISOString();

  if (!webhookConfig.enabled) {
    return {
      success: false,
      event,
      error: 'Webhook service is not enabled. Set N8N_WEBHOOK_URL to enable.',
      attemptedAt,
    };
  }

  const payload: WebhookPayload = {
    event,
    timestamp: attemptedAt,
    data,
    metadata,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${webhookConfig.secret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      success: response.ok,
      event,
      statusCode: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      attemptedAt,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      event,
      error: `Network error: ${message}`,
      attemptedAt,
    };
  }
}
