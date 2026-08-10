import { NextRequest, NextResponse } from 'next/server';
import { smsService, mapTwilioMessageStatus } from '@/services/sms.service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

/**
 * ─── Twilio Status Callback Route ─────────────────────────────────────────
 *
 * POST /api/sms/status
 *
 * Receives delivery-status callbacks from Twilio (the StatusCallback URL
 * configured on the outbound message). Twilio POSTs form-encoded params:
 *   MessageSid, MessageStatus, ErrorCode, ErrorMessage, To, From, ...
 *
 * Maps MessageStatus onto the app SmsStatus union and flips the sms_logs row
 * sent → delivered / failed, so FEATURES feature 11 delivery tracking is
 * reachable end-to-end (this is the only writer of `delivered`).
 *
 * Authentication: Twilio signs callbacks with `X-Twilio-Signature`
 * (HMAC-SHA1 over the full request URL + sorted body params, keyed by the
 * account auth token). When TWILIO_AUTH_TOKEN is configured the signature is
 * verified; without it the payload is still processed (development mode) —
 * mirroring the optional-verification structure of the Resend webhook route.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Twilio-style form body parser (application/x-www-form-urlencoded).
 * Values are URL-decoded; '+' decodes to space.
 */
function parseFormBody(rawBody: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of rawBody.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const key = decodeURIComponent(pair.slice(0, eq).replace(/\+/g, ' '));
    const value = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
    params[key] = value;
  }
  return params;
}

/**
 * Twilio signature verification (X-Twilio-Signature).
 * HMAC-SHA1 of `url + sorted(key + value) pairs` with the auth token,
 * compared base64 to the header. Same Web Crypto approach as the Resend
 * webhook's verifySignatureAsync.
 */
async function verifySignatureAsync(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string,
): Promise<boolean> {
  if (!signature) return false;
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => key + params[key])
    .join('');
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(authToken);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(url + sortedParams));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  return expected === signature;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to read request body' }, { status: 400, headers: corsHeaders() });
  }

  let params: Record<string, string>;
  try {
    params = parseFormBody(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: 'Malformed form body' }, { status: 400, headers: corsHeaders() });
  }

  const messageSid = params.MessageSid;
  const messageStatus = params.MessageStatus;

  if (!messageSid || !messageStatus) {
    return NextResponse.json(
      { success: false, error: 'Missing MessageSid or MessageStatus' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Optional signature verification — dev mode without an auth token processes
  // unverified (mirrors the Resend webhook route's optional-verification).
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get('x-twilio-signature');
  if (authToken) {
    const valid = await verifySignatureAsync(request.url, params, signature, authToken);
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401, headers: corsHeaders() });
    }
  } else if (signature) {
    // Token not configured but a signature was sent — cannot verify. Process
    // anyway in development; production must configure TWILIO_AUTH_TOKEN.
    console.warn('[sms/status] TWILIO_AUTH_TOKEN not set — callback signature not verified');
  }

  const errorCode = params.ErrorCode;
  const errorMessage = params.ErrorMessage;
  const error = errorCode
    ? `Twilio error ${errorCode}${errorMessage ? `: ${errorMessage}` : ''}`
    : undefined;

  try {
    const supabase = await createServerSupabaseClient();
    const { data: row } = await supabase
      .from('sms_logs')
      .select('*')
      .eq('provider_message_id', messageSid)
      .maybeSingle();

    if (row && typeof row.id === 'string') {
      await smsService.updateStatus(row.id, mapTwilioMessageStatus(messageStatus), {
        errorMessage: error,
      });
    } else {
      console.warn(`[sms/status] No sms_logs row for provider_message_id=${messageSid}`);
    }
  } catch (e) {
    // Never fail the callback loudly — Twilio retries on non-2xx. Log and ack.
    console.error(`[sms/status] Error updating SMS ${messageSid}:`, e);
  }

  return NextResponse.json(
    { success: true, processed: `${messageSid}:${mapTwilioMessageStatus(messageStatus)}` },
    { status: 200, headers: corsHeaders() },
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
