import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders } from '@/lib/cors';

/**
 * ─── Resend Webhook Route ────────────────────────────────────────────
 *
 * POST /api/email/webhook/resend
 *
 * Receives delivery status webhooks from Resend (powered by Svix).
 * Resend sends real-time events when an email is delivered, bounced,
 * or complained about. This endpoint updates the corresponding
 * email_history record status.
 *
 * Authentication:
 *   Resend signs webhook payloads using Svix. The signature is in the
 *   svix-signature header. If RESEND_WEBHOOK_SECRET is configured, the
 *   signature is verified. If not set, the payload is still processed
 *   (development mode).
 *
 * Environment variables:
 *   RESEND_WEBHOOK_SECRET — Svix signing secret for webhook verification
 *
 * Reference: https://resend.com/docs/webhooks
 * ─────────────────────────────────────────────────────────────────────
 */

// ── Types ─────────────────────────────────────────────────────────────

/** Resend webhook event types related to delivery status. */
type ResendWebhookEventType =
  | 'email.delivered'
  | 'email.bounced'
  | 'email.complained';

/** Payload data within a Resend webhook event. */
interface ResendWebhookData {
  email_id: string;
  to: string[];
  from?: string;
  subject?: string;
  bounce_type?: string;
  bounce_code?: number;
  complaint_type?: string;
  created_at?: string;
}

/** Full Resend webhook event payload. */
interface ResendWebhookPayload {
  type: ResendWebhookEventType;
  created_at: string;
  data: ResendWebhookData;
}

/** Success response. */
interface WebhookSuccessResponse {
  success: true;
  processed: string[];
  timestamp: string;
}

/** Error response. */
interface WebhookErrorResponse {
  success: false;
  error: string;
}

type WebhookResponse = WebhookSuccessResponse | WebhookErrorResponse;

// ── Event mapping ─────────────────────────────────────────────────────

/**
 * Maps Resend webhook event types to email_history status values.
 *
 * - email.delivered  → 'sent'
 * - email.bounced    → 'failed' (bounce = permanent delivery failure)
 * - email.complained → 'failed' (spam complaint — mark as failed)
 */
const EVENT_STATUS_MAP: Record<ResendWebhookEventType, string> = {
  'email.delivered': 'sent',
  'email.bounced': 'failed',
  'email.complained': 'failed',
};

// ── Svix signature verification ──────────────────────────────────────

/**
 * Async Svix signature verification using Web Crypto API (HMAC-SHA256).
 *
 * Resend uses Svix for webhook delivery. The signature is sent in the
 * svix-signature header. Verification is optional — if the secret is
 * not configured, the webhook is still processed in development mode.
 *
 * Reference: https://docs.svix.com/reception/verifying-payloads
 */
async function verifySignatureAsync(
  payload: string,
  svixSignatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!svixSignatureHeader) return false;

  const signatures = svixSignatureHeader
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3));

  if (signatures.length === 0) return false;

  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(secret);
  const payloadBytes = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  for (const sigBase64 of signatures) {
    try {
      const sigBytes = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0));
      const isValid = await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, payloadBytes);
      if (isValid) return true;
    } catch {
      // Invalid base64 — skip this signature
      continue;
    }
  }

  return false;
}

/**
 * Updates the email_history row status based on the webhook event.
 */
async function updateEmailStatus(
  providerEmailId: string,
  status: string,
): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('email_history') as any).update({ status })
      .eq('provider_message_id', providerEmailId);

    if (error) {
      console.warn(`[resend-webhook] Failed to update email status: providerEmailId=${providerEmailId} error=${error.message}`);
      return false;
    }

    return true;
  } catch (e) {
    console.error(`[resend-webhook] Exception updating email status: providerEmailId=${providerEmailId} error=${e instanceof Error ? e.message : 'Unknown error'}`);
    return false;
  }
}

// ── Route Handler ─────────────────────────────────────────────────────

/**
 * OPTIONS /api/email/webhook/resend
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
 * POST /api/email/webhook/resend
 *
 * Processes delivery status updates from Resend webhooks.
 *
 * The raw body must be read as text first for signature verification,
 * then parsed as JSON.
 */

export async function POST(request: NextRequest): Promise<NextResponse<WebhookResponse>> {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit('resend-webhook:' + ip, 60, 60000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
  }

  // Read raw body text for signature verification
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to read request body' },
      { status: 400, headers: corsHeaders() },
    );
  }

  if (!rawBody || rawBody.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Empty request body' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // In production the webhook secret must be configured
  if (process.env.NODE_ENV === 'production' && !process.env.RESEND_WEBHOOK_SECRET) {
    console.error(
      '[resend-webhook] RESEND_WEBHOOK_SECRET is not set. ' +
      'Webhook signature verification is disabled. Set this env var in production.'
    );
    return NextResponse.json(
      { success: false, error: 'Webhook secret not configured' },
      { status: 500, headers: corsHeaders() },
    );
  }

  // Optional: verify Svix signature
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const svixSignature = request.headers.get('svix-signature');

  if (webhookSecret && svixSignature) {
    const isValid = await verifySignatureAsync(rawBody, svixSignature, webhookSecret);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid webhook signature' },
        { status: 401, headers: corsHeaders() },
      );
    }
  } else if (webhookSecret && !svixSignature) {
    // Secret configured but no signature header — reject in production
    return NextResponse.json(
      { success: false, error: 'Missing svix-signature header' },
      { status: 401, headers: corsHeaders() },
    );
  }
  // No secret configured = development mode, process without verification

  // Parse the webhook payload
  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Resend may send a batch of events as an array
  const events: ResendWebhookPayload[] = Array.isArray(payload)
    ? payload
    : [payload];

  const processed: string[] = [];
  const supportedEvents = new Set<ResendWebhookEventType>(['email.delivered', 'email.bounced', 'email.complained']);

  for (const event of events) {
    if (!supportedEvents.has(event.type)) {
      // Silent skip for unsupported event types (email.sent, email.opened, etc.)
      continue;
    }

    const status = EVENT_STATUS_MAP[event.type];
    const { email_id } = event.data;

    if (!email_id) {
      console.warn(`[resend-webhook] Webhook event missing email_id (event: ${event.type})`);
      continue;
    }

    const updated = await updateEmailStatus(email_id, status);
    processed.push(`${email_id}:${status}:${updated ? 'ok' : 'failed'}`);

    // Operational log for webhook debugging
    console.info(`[resend-webhook] event=${event.type} emailId=${email_id} status=${status} updated=${updated}`);
  }

  return NextResponse.json(
    {
      success: true,
      processed,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: corsHeaders() },
  );
}
