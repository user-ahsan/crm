import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders } from '@/lib/cors';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * ─── n8n Webhook Route Handler ───────────────────────────────────────
 *
 * Receives webhook events from n8n workflows and processes them based on
 * event type. Supports all CRM entity events: leads, contacts, companies,
 * tasks, and meetings.
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

// ── Webhook event type definitions ────────────────────────────────────

/** All supported webhook events that n8n can trigger. */
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
  'task.completed',
  'task.overdue',
]);

const MEETING_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  'meeting.created',
  'meeting.completed',
]);

const ALL_EVENTS: ReadonlySet<WebhookEvent> = new Set([
  ...LEAD_EVENTS,
  ...CONTACT_EVENTS,
  ...COMPANY_EVENTS,
  ...TASK_EVENTS,
  ...MEETING_EVENTS,
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
    case 'task.completed':
      return `Task completed: ${entityName} (${entityId})`;
    case 'task.overdue':
      return `Task overdue: ${entityName} (${entityId}) — requires attention`;

    // ── Meeting events ───────────────────────────────────────────
    case 'meeting.created':
      return `Meeting scheduled: ${entityName} (${entityId})`;
    case 'meeting.completed':
      return `Meeting completed: ${entityName} (${entityId})`;

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
     
    await supabase.from('webhook_events').insert({
      source: 'n8n',
      event_type: body.event || 'unknown',
      payload: body,
      status: 'received',
      created_at: receivedAt,
    } as never);
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
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
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
