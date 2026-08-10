/**
 * ─── Webhook Event Types ───────────────────────────────────────────────
 *
 * Shared type definitions for webhook events used across the CRM system.
 * Both the webhook service (outbound) and the n8n route handler (inbound)
 * reference the same event types to ensure consistency.
 *
 * This file exists to break the circular dependency that occurred when
 * webhook.service.ts imported from the route file directly.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * All supported webhook events triggered by CRM entity changes.
 *
 * This is the SINGLE source of truth for event names. The n8n inbound
 * route (`app/api/webhook/n8n/route.ts`) whitelists exactly this union,
 * and every service that calls `triggerWebhook(...)` / automation
 * `evaluate(...)` must use one of these names. If a new event is needed:
 *   1. add it here,
 *   2. add it to the route's event sets (it is validated against them),
 *   3. dispatch it from the owning entity service after the mutation.
 *
 * Events marked "dispatched" are fired today; the rest are declared for
 * the documented contracts and wired by entity-service agents per
 * `.tmp/audit/fixes/PATTERN-webhooks.md`.
 */
export type WebhookEvent =
  // ── Lead events (dispatched: created/updated/deleted; status_changed via PATTERN-webhooks) ──
  | 'lead.created'
  | 'lead.updated'
  | 'lead.deleted'
  | 'lead.status_changed'
  // ── Contact events (all dispatched) ──
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  // ── Company events (all dispatched) ──
  | 'company.created'
  | 'company.updated'
  | 'company.deleted'
  // ── Task events (dispatched: created/updated/deleted; completed/overdue via PATTERN-webhooks) ──
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'task.overdue'
  | 'task.deleted'
  // ── Meeting events (dispatched: created/updated/deleted; completed via PATTERN-webhooks) ──
  | 'meeting.created'
  | 'meeting.updated'
  | 'meeting.completed'
  | 'meeting.deleted'
  // ── Deal events (dispatched: created/updated/deleted; stage_changed via PATTERN-webhooks) ──
  | 'deal.created'
  | 'deal.updated'
  | 'deal.deleted'
  | 'deal.stage_changed'
  // ── Quote events (declared; dispatches wired by quote-service agent) ──
  | 'quote.created'
  | 'quote.updated'
  // ── Campaign scheduler lifecycle events (declared; dispatches wired by scheduler agent) ──
  | 'campaign.activated'
  | 'campaign.paused'
  | 'campaign.completed'
  // ── System events (all dispatched) ──
  | 'activity.created'
  | 'team.created'
  | 'team.updated'
  | 'email.sent';
