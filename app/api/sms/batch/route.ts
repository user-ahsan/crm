import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { smsService } from '@/services/sms.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';
import type { SmsRelatedEntity } from '@/types/sms.types';

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

// ── Request / Response Types ───────────────────────────────────────────────

interface BatchSmsItem {
  toNumber: string;
  body: string;
  relatedToType?: SmsRelatedEntity;
  relatedToId?: string;
}

interface BatchSmsRequest {
  messages: BatchSmsItem[];
}

interface BatchSmsResult {
  toNumber: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

interface BatchSmsResponse {
  results: BatchSmsResult[];
}

// ── Route Handler ──────────────────────────────────────────────────────────

/**
 * POST /api/sms/batch
 *
 * Sends multiple SMS messages in sequence via Twilio and persists each
 * to the database. Each message is processed independently — a failure
 * in one does not cancel the others.
 *
 * Body (JSON):
 *   - messages: Array<{
 *       toNumber: string (required),
 *       body: string (required),
 *       relatedToType?: 'lead' | 'contact' | 'company' | 'deal',
 *       relatedToId?: string
 *     }>
 *
 * Returns 200 with per-message results, 400 for invalid payload structure.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<BatchSmsResponse>> {
  // Body size limit
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1024 * 1024) { // 1MB limit
    return NextResponse.json(
      { results: [] },
      { status: 413, headers: corsHeaders() },
    );
  }

  // ── CSRF / Origin check ───────────────────────────────────────
  if (!validateCsrf(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden', results: [] }, { status: 403, headers: corsHeaders() });
  }

  // ── Auth check ─────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  let user;
  try {
    const { data: { user: u }, error: authError } = await supabase.auth.getUser();
    if (authError || !u) {
      return NextResponse.json({ success: false, error: 'Unauthorized', results: [] }, { status: 401, headers: corsHeaders() });
    }
    user = u;
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized', results: [] }, { status: 401, headers: corsHeaders() });
  }

  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(user.id || 'anon:' + ip, 60, 60000)) {
    return NextResponse.json({ success: false, error: 'Too many requests', results: [] }, { status: 429, headers: corsHeaders() });
  }

  // Parse request body
  let body: BatchSmsRequest;
  try {
    body = (await request.json()) as BatchSmsRequest;
  } catch {
    return NextResponse.json(
      { results: [] },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Validate messages array
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { results: [] },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Limit batch size
  if (body.messages.length > 100) {
    return NextResponse.json(
      { results: [] },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Validate each message has required fields
  const validated: BatchSmsItem[] = [];
  const errors: BatchSmsResult[] = [];

  for (let i = 0; i < body.messages.length; i++) {
    const msg = body.messages[i];

    if (!msg.toNumber || typeof msg.toNumber !== 'string' || msg.toNumber.trim().length === 0) {
      errors.push({
        toNumber: msg.toNumber ?? `index ${i}`,
        success: false,
        error: 'Missing required field: toNumber',
      });
      continue;
    }

    // Validate E.164 format
    if (!E164_PATTERN.test(msg.toNumber.trim())) {
      errors.push({
        toNumber: msg.toNumber,
        success: false,
        error: 'Invalid E.164 format',
      });
      continue;
    }

    if (!msg.body || typeof msg.body !== 'string' || msg.body.trim().length === 0) {
      errors.push({
        toNumber: msg.toNumber,
        success: false,
        error: 'Missing required field: body',
      });
      continue;
    }

    validated.push({
      toNumber: msg.toNumber.trim(),
      body: msg.body.trim(),
      relatedToType: msg.relatedToType,
      relatedToId: msg.relatedToId,
    });
  }

  // Send validated messages via batch service
  let results: BatchSmsResult[] = errors;

  if (validated.length > 0) {
    try {
      const serviceResults = await smsService.sendBatchSms(validated);
      results = [...serviceResults, ...errors];
    } catch (e) {
      // Service-level failure — mark all validated as failed
      console.error(`[sms/batch] Error:`, e);
      const failedResults: BatchSmsResult[] = validated.map((v) => ({
        toNumber: v.toNumber,
        success: false,
        error: 'An internal error occurred',
      }));
      results = [...failedResults, ...errors];
    }
  }

  return NextResponse.json({ results }, { status: 200, headers: corsHeaders() });
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
