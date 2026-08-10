import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders } from '@/lib/cors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { WebhookEvent } from '@/types/webhook.types';

/**
 * ─── n8n Webhook Route Handler ───────────────────────────────────────
 *
 * Receives webhook events from n8n workflows and processes them based on
 * event type. Supports all CRM entity events: leads, contacts, companies,
 * tasks, meetings, deals, quotes, campaigns, and system events.
 *
 * The event whitelist is the `WebhookEvent` union from
 * `types/webhook.types.ts` (the single source of truth) — never define a
 * second copy here or the whitelist and the services will drift.
 *
 * Authentication:
 *   POST requests must include an Authorization header:
 *     Authorization: Bearer {N8N_WEBHOOK_SECRET}
 *   GET health-check requests must include an x-api-key header:
 *     x-api-key: {N8N_WEBHOOK_SECRET}
 *
 * Environment variables:
 *   N8N_WEBHOOK_SECRET — Shared secret for bearer/api-key auth.
 *   This MUST be set in production.
 * ─────────────────────────────────────────────────────────────────────
 */

// Re-export for consumers that referenced the route's type pre-refactor.
export type { WebhookEvent };

// ── Webhook event type definitions ────────────────────────────────────

/** Events are grouped by entity for validation. */
const LEAD_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  'lead.created',
  'lead.updated',
  'lead.deleted',
  'lead.status_changed',
]);

const CONTACT_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  'contact.created',
  'contact.updated',
  'contact.deleted',
]);

const COMPANY_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  'company.created',
  'company.updated',
  'company.deleted',
]);

const TASK_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  'task.created',
  'task.updated',
  'task.completed',
  'task.overdue',
  'task.deleted',
]);

const MEETING_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  'meeting.created',
  'meeting.updated',
  'meeting.completed',
  'meeting.deleted',
]);

const DEAL_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  'deal.created',
  'deal.updated',
  'deal.deleted',
  'deal.stage_changed',
]);

const QUOTE_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  'quote.created',
  'quote.updated',
]);

const CAMPAIGN_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  'campaign.activated',
  'campaign.paused',
  'campaign.completed',
]);

const SYSTEM_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  'activity.created',
  'team.created',
  'team.updated',
  'email.sent',
]);

const ALL_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  ...LEAD_EVENTS,
  ...CONTACT_EVENTS,
  ...COMPANY_EVENTS,
  ...TASK_EVENTS,
  ...MEETING_EVENTS,
  ...DEAL_EVENTS,
  ...QUOTE_EVENTS,
  ...CAMPAIGN_EVENTS,
  ...SYSTEM_EVENTS,
]);

/** Payload received from n8n webhook requests. */
export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/** Standard success response shape. */
interface SuccessResponse {
  success: true;
  message: string;
  receivedAt: string;
}

/** Standard error response shape. */
interface ErrorResponse {
  success: false;
  error: string;
}

/** Health check response shape. */
interface HealthResponse {
  status: 'ok';
  version: string;
  webhook: string;
  supportedEvents: WebhookEvent[];
}

type ApiResponse = SuccessResponse | ErrorResponse | HealthResponse;

/**
 * Row shape for the `webhook_events` ingest table (created by the
 * schema migration batch — see `supabase/migrations`). Kept local until
 * `types/supabase.types.ts` is regenerated with the table so the insert
 * stays fully typed (no `as never`). Column names match the migration.
 */
interface WebhookEventInsertRow {
  source: string;
  event_type: string;
  payload: WebhookPayload;
  status: 'received';
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Timing-safe comparison of the Authorization header against the
 * webhook secret, mitigating timing-attack vector.
 */
function isWebhookAuthorized(authHeader: string | null, secret: string | undefined): boolean {
  if (!authHeader || !secret) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Returns the webhook secret or undefined if not configured.
 */
function getWebhookSecret(): string | undefined {
  return process.env.N8N_WEBHOOK_SECRET;
}

/**
 * Validates that the event is a recognized webhook event.
 */
function isValidEvent(event: string): event is WebhookEvent {
  return ALL_EVENTS.has(event as WebhookEvent);
}

/**
 * Processes an incoming webhook payload and returns a human-readable
 * summary of the action taken.
 */
function processWebhookEvent(body: WebhookPayload): string {
  const { event, data } = body;
  const entityId = (data.id as string) || 'unknown';
  const entityName = (data.fullName || data.name || data.title || entityId) as string;

  switch (event) {
    // ── Lead events ──────────────────────────────────────────────
    case 'lead.created':
      return `Lead created: ${entityName} (${entityId})`;
    case 'lead.updated':
      return `Lead updated: ${entityName} (${entityId})`;
    case 'lead.deleted':
      return `Lead deleted: ${entityName} (${entityId})`;
    case 'lead.status_changed': {
      const from = (data.previousStatus as string) || 'unknown';
      const to = (data.status as string) || 'unknown';
      return `Lead status changed: ${entityName} — ${from} → ${to}`;
    }

    // ── Contact events ───────────────────────────────────────────
    case 'contact.created':
      return `Contact created: ${entityName} (${entityId})`;
    case 'contact.updated':
      return `Contact updated: ${entityName} (${entityId})`;
    case 'contact.deleted':
      return `Contact deleted: ${entityName} (${entityId})`;

    // ── Company events ───────────────────────────────────────────
    case 'company.created':
      return `Company created: ${entityName} (${entityId})`;
    case 'company.updated':
      return `Company updated: ${entityName} (${entityId})`;
    case 'company.deleted':
      return `Company deleted: ${entityName} (${entityId})`;

    // ── Task events ──────────────────────────────────────────────
    case 'task.created':
      return `Task created: ${entityName} (${entityId})`;
    case 'task.updated':
      return `Task updated: ${entityName} (${entityId})`;
    case 'task.completed':
      return `Task completed: ${entityName} (${entityId})`;
    case 'task.overdue':
      return `Task overdue: ${entityName} (${entityId}) — requires attention`;
    case 'task.deleted':
      return `Task deleted: ${entityName} (${entityId})`;

    // ── Meeting events ───────────────────────────────────────────
    case 'meeting.created':
      return `Meeting scheduled: ${entityName} (${entityId})`;
    case 'meeting.updated':
      return `Meeting updated: ${entityName} (${entityId})`;
    case 'meeting.completed':
      return `Meeting completed: ${entityName} (${entityId})`;
    case 'meeting.deleted':
      return `Meeting deleted: ${entityName} (${entityId})`;

    // ── Deal events ──────────────────────────────────────────────
    case 'deal.created':
      return `Deal created: ${entityName} (${entityId})`;
    case 'deal.updated':
      return `Deal updated: ${entityName} (${entityId})`;
    case 'deal.deleted':
      return `Deal deleted: ${entityName} (${entityId})`;
    case 'deal.stage_changed': {
      const fromStage = (data.previousStageId as string) || 'unknown';
      const toStage = (data.stageId as string) || 'unknown';
      return `Deal stage changed: ${entityName} — ${fromStage} → ${toStage}`;
    }

    // ── Quote events ─────────────────────────────────────────────
    case 'quote.created':
      return `Quote created: ${entityName} (${entityId})`;
    case 'quote.updated':
      return `Quote updated: ${entityName} (${entityId})`;

    // ── Campaign lifecycle events ────────────────────────────────
    case 'campaign.activated':
      return `Campaign activated: ${entityName} (${entityId})`;
    case 'campaign.paused':
      return `Campaign paused: ${entityName} (${entityId})`;
    case 'campaign.completed':
      return `Campaign completed: ${entityName} (${entityId})`;

    // ── System events ────────────────────────────────────────────
    case 'activity.created':
      return `Activity recorded: ${entityName} (${entityId})`;
    case 'team.created':
      return `Team created: ${entityName} (${entityId})`;
    case 'team.updated':
      return `Team updated: ${entityName} (${entityId})`;
    case 'email.sent':
      return `Email sent: ${entityName} (${entityId})`;

    default:
      return `Unknown event received: ${event}`;
  }
}

// ── Route Handlers ────────────────────────────────────────────────────

/**
 * POST /api/webhook/n8n
 *
 * Receives and processes webhook events from n8n workflows.
 * Requires Authorization: Bearer {secret} header.
 *
 * Body (JSON):
 *   - event: WebhookEvent — the event type
 *   - timestamp: string — ISO 8601 timestamp of when the event occurred
 *   - data: Record<string, unknown> — event payload data
 *   - metadata?: Record<string, unknown> — optional additional context
 *
 * Returns 200 on success, 400 for invalid payload, 401 for bad auth.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1_048_576) {
    return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413, headers: corsHeaders() });
  }

  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit('webhook-n8n:' + ip, 60, 60000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
  }

  const webhookSecret = getWebhookSecret();

  if (!webhookSecret) {
    return NextResponse.json(
      { success: false, error: 'Webhook secret not configured' },
      { status: 401, headers: corsHeaders() },
    );
  }

  // Verify bearer token via timing-safe comparison
  const authHeader = request.headers.get('authorization');
  if (!isWebhookAuthorized(authHeader, webhookSecret)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: corsHeaders() },
    );
  }

  // Parse and validate the request body
  let body: WebhookPayload;
  try {
    body = await request.json() as WebhookPayload;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Validate required fields
  if (!body.event || !body.timestamp || !body.data) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: event, timestamp, data' },
      { status: 400, headers: corsHeaders() },
    );
  }

  if (!isValidEvent(body.event)) {
    return NextResponse.json(
      {
        success: false,
        error: `Unsupported event: ${body.event}. Supported events: ${Array.from(ALL_EVENTS).join(', ')}`,
      },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Validate timestamp format
  const parsedTimestamp = new Date(body.timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return NextResponse.json(
      { success: false, error: 'Invalid timestamp format. Must be ISO 8601.' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Process the event
  const summary = processWebhookEvent(body);
  const receivedAt = new Date().toISOString();

  // Persist webhook event to database
  try {
    const supabase = await createServerSupabaseClient();

    const webhookEventRow: WebhookEventInsertRow = {
      source: 'n8n',
      event_type: body.event,
      payload: body,
      status: 'received',
      created_at: receivedAt,
    };

    await supabase.from('webhook_events').insert(webhookEventRow);
  } catch (dbError) {
    console.error('Failed to persist webhook event:', dbError);
  }

  // Operational log for webhook delivery debugging
  console.info(`[n8n-webhook] event=${body.event} entityId=${(body.data.id as string) || 'unknown'} summary=${summary}`);

  return NextResponse.json(
    {
      success: true,
      message: summary,
      receivedAt,
    },
    { status: 200, headers: corsHeaders() },
  );
}

/**
 * OPTIONS /api/webhook/n8n
 *
 * CORS preflight for webhook endpoints.
 */
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: corsHeaders(),
  });
}

/**
 * GET /api/webhook/n8n
 *
 * Health check endpoint for n8n to verify the webhook endpoint is
 * reachable and responding. Returns the list of supported events.
 *
 * Requires x-api-key header matching N8N_WEBHOOK_SECRET.
 */

export async function GET(request: NextRequest): Promise<NextResponse<HealthResponse | ErrorResponse>> {
  const webhookSecret = getWebhookSecret();

  if (!webhookSecret) {
    return NextResponse.json(
      { success: false, error: 'Webhook secret not configured' },
      { status: 401 },
    );
  }

  const apiKey = request.headers.get('x-api-key');
  const keyBuffer = Buffer.from(apiKey || '');
  const secretBuffer = Buffer.from(webhookSecret || '');
  const valid = keyBuffer.length === secretBuffer.length && timingSafeEqual(keyBuffer, secretBuffer);
  if (!valid) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      status: 'ok',
      version: '1.0.0',
      webhook: 'nexuscrm-n8n-integration',
      supportedEvents: Array.from(ALL_EVENTS),
    },
    { status: 200 },
  );
}
