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

/** All supported webhook events triggered by CRM entity changes. */
export type WebhookEvent =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.deleted'
  | 'lead.status_changed'
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'company.created'
  | 'company.updated'
  | 'company.deleted'
  | 'task.created'
  | 'task.completed'
  | 'task.overdue'
  | 'meeting.created'
  | 'meeting.completed';
