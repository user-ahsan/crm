import { NextRequest, NextResponse } from 'next/server';
import { getTwilioClientAsync, getTwilioFromNumber, isTwilioConfigured } from '@/lib/twilio'; // server-only route — safe
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';

/**
 * ─── SMS Test Route ────────────────────────────────────────────────────
 *
 * POST /api/sms/test
 *
 * Sends a single test SMS via Twilio. Unlike the main send endpoint,
 * this does not persist the message to the database — it is purely for
 * verifying that the Twilio configuration is working correctly.
 *
 * Body (JSON):
 *   - toNumber: string (required) — recipient in E.164 format
 *   - body?: string               — message body (default: "Test from NexusCRM")
 *
 * Response (200):
 *   - success: true
 *   - messageSid: string         — Twilio Message SID
 *   - fromNumber: string         — sender number used
 *
 * Response (400/500):
 *   - success: false
 *   - error: string              — human-readable error description
 * ───────────────────────────────────────────────────────────────────────
 */

interface TestSmsRequest {
  toNumber: string;
  body?: string;
}

interface TestSmsSuccessResponse {
  success: true;
  messageSid: string;
  fromNumber: string;
}

interface TestSmsErrorResponse {
  success: false;
  error: string;
}

type TestSmsResponse = TestSmsSuccessResponse | TestSmsErrorResponse;

/** Basic E.164 phone number pattern: leading plus, then 7-15 digits. */
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<TestSmsResponse>> {
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1_048_576) {
    return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413, headers: corsHeaders() });
  }

  // ── CSRF / Origin check ───────────────────────────────────────
  if (!validateCsrf(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  // ── Auth check ─────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  let user;
  try {
    const { data: { user: u }, error: authError } = await supabase.auth.getUser();
    if (authError || !u) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }
    user = u;
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(user.id || 'anon:' + ip, 60, 60000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
  }

  // ── Parse body ──────────────────────────────────────────────────────
  let body: TestSmsRequest;
  try {
    body = (await request.json()) as TestSmsRequest;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // ── Validate toNumber ───────────────────────────────────────────────
  if (!body.toNumber || typeof body.toNumber !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing required field: toNumber' },
      { status: 400, headers: corsHeaders() },
    );
  }

  const toNumber = body.toNumber.trim();
  if (!E164_PATTERN.test(toNumber)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Invalid phone number format. Must be in E.164 format (e.g. +15551234567).',
      },
      { status: 400, headers: corsHeaders() },
    );
  }

  // ── Send via Twilio ─────────────────────────────────────────────────
  if (!isTwilioConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.' },
      { status: 400, headers: corsHeaders() },
    );
  }
  try {
    const client = await getTwilioClientAsync();
    const fromNumber = getTwilioFromNumber();

    const message = await client.messages.create({
      body: body.body?.trim() || 'Test from NexusCRM',
      to: toNumber,
      from: fromNumber,
    });

    return NextResponse.json(
      {
        success: true,
        messageSid: message.sid,
        fromNumber,
      },
      { status: 200, headers: corsHeaders() },
    );
  } catch (e) {
    console.error(`[sms/test] Error:`, e);
    return NextResponse.json(
      { success: false, error: 'An internal error occurred' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
