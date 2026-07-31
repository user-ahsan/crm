import { NextRequest, NextResponse } from 'next/server';
import { smsService } from '@/services/sms.service';
import { getTwilioClientAsync, getTwilioFromNumber } from '@/lib/twilio';
import { getServiceConfig } from '@/lib/service-config';
import { getSupabaseClient } from '@/lib/supabase/client';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';
import type { SmsRelatedEntity } from '@/types/sms.types';

interface SendSmsRequest {
  toNumber: string;
  body: string;
  fromNumber?: string;
  relatedToType?: SmsRelatedEntity;
  relatedToId?: string;
}

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

/**
 * POST /api/sms/send
 * Sends an SMS via Twilio AND persists to DB.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Body size limit
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1024 * 1024) { // 1MB limit
    return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413, headers: corsHeaders() });
  }

  // ── CSRF / Origin check ───────────────────────────────────────
  if (!validateCsrf(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  // ── Auth check ─────────────────────────────────────────────────
  const supabase = getSupabaseClient();
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

  let body: SendSmsRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400, headers: corsHeaders() });
  }

  const toNumber = body.toNumber?.trim();
  const msgBody = body.body?.trim();
  if (!toNumber || !msgBody) {
    return NextResponse.json({ success: false, error: 'toNumber and body required' }, { status: 400, headers: corsHeaders() });
  }
  if (!E164_PATTERN.test(toNumber)) {
    return NextResponse.json({ success: false, error: 'Phone must be E.164 format (e.g. +15551234567)' }, { status: 400, headers: corsHeaders() });
  }

  // 1. Try actual Twilio send (only if configured — Supabase UI config first, env fallback)
  const smsConfig = await getServiceConfig('sms');
  const hasTwilio = !!(smsConfig.account_sid && smsConfig.auth_token);

  let providerMessageId: string | undefined;
  let twilioError: string | undefined;
  if (!hasTwilio) {
    twilioError = 'SMS provider not configured. Add Twilio credentials in Settings > Services.';
  } else {
    try {
      const client = await getTwilioClientAsync();
      const from = smsConfig.from_number || getTwilioFromNumber();
      const message = await client.messages.create({ body: msgBody, to: toNumber, from });
      providerMessageId = message.sid;
    } catch (e: unknown) {
      console.error(`[sms/send] Twilio error:`, e);
      twilioError = 'An internal error occurred';
    }
  }

  // 2. Log to DB (always, even on Twilio failure)
  try {
    const smsLog = await smsService.send({
      toNumber, body: msgBody,
      fromNumber: body.fromNumber,
      relatedToType: body.relatedToType,
      relatedToId: body.relatedToId,
    });

    return NextResponse.json({
      success: !twilioError,
      smsId: smsLog.id,
      providerMessageId,
      error: twilioError,
    }, { status: 201, headers: corsHeaders() });
  } catch (e: unknown) {
    console.error(`[sms/send] DB log error:`, e);
    return NextResponse.json({ success: false, error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
