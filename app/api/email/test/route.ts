import { NextRequest, NextResponse } from 'next/server';
import { getResendClient, isResendConfigured } from '@/lib/email';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';

/**
 * ─── Email Test Route ─────────────────────────────────────────────────
 *
 * POST /api/email/test
 *
 * Sends a simple test email via Resend to verify the email configuration
 * (RESEND_API_KEY, RESEND_FROM_EMAIL env vars) works correctly.
 *
 * Body (JSON):
 *   - toAddress: string — recipient email address (required)
 *
 * Returns 200 with { success, messageId } on success.
 * Returns 400 for missing/invalid fields.
 * Returns 500 on service failure.
 * ─────────────────────────────────────────────────────────────────────
 */

interface TestSuccessResponse {
  success: true;
  messageId: string;
}

interface TestErrorResponse {
  success: false;
  error: string;
}

type TestResponse = TestSuccessResponse | TestErrorResponse;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/email/test
 *
 * Validates the toAddress, sends a minimal test email through Resend,
 * and returns the provider message ID on success.
 */
export async function POST(request: NextRequest): Promise<NextResponse<TestResponse>> {
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

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Validate toAddress
  const toAddress = typeof body.toAddress === 'string' ? body.toAddress.trim() : '';
  if (!toAddress) {
    return NextResponse.json(
      { success: false, error: 'Missing required field: toAddress' },
      { status: 400, headers: corsHeaders() },
    );
  }
  if (!EMAIL_PATTERN.test(toAddress)) {
    return NextResponse.json(
      { success: false, error: 'Invalid toAddress: must be a valid email address' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Validate from address + API key — environment variables must be set
  const fromAddress = process.env.RESEND_FROM_EMAIL;
  if (!fromAddress) {
    return NextResponse.json(
      { success: false, error: 'RESEND_FROM_EMAIL not configured' },
      { status: 400, headers: corsHeaders() },
    );
  }
  if (!isResendConfigured()) {
    return NextResponse.json(
      { success: false, error: 'RESEND_API_KEY not configured — email provider is disabled' },
      { status: 400, headers: corsHeaders() },
    );
  }
  const fromName = process.env.RESEND_FROM_NAME || 'NexusCRM';

  // Attempt to send test email via Resend
  try {
    const resend = getResendClient();

    const result = await resend.emails.send({
      from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
      to: toAddress,
      subject: 'Test Email — NexusCRM Configuration',
      text: [
        'This is a test email from NexusCRM.',
        '',
        'If you received this, your email configuration is working correctly.',
        `Sent at: ${new Date().toISOString()}`,
        '',
        '— NexusCRM',
      ].join('\n'),
    });

    if (result.error && typeof result.error === 'object' && 'message' in result.error) {
      const err = result.error as { message?: string };
      return NextResponse.json(
        { success: false, error: err.message || 'Resend API returned an error' },
        { status: 500, headers: corsHeaders() },
      );
    }
    if (result.error) {
      return NextResponse.json(
        { success: false, error: String(result.error) },
        { status: 500, headers: corsHeaders() },
      );
    }

    return NextResponse.json(
      {
        success: true,
        messageId: result.data?.id ?? 'unknown',
      },
      { status: 200, headers: corsHeaders() },
    );
  } catch (e) {
    console.error(`[email/test] Error:`, e);
    return NextResponse.json(
      { success: false, error: 'An internal error occurred' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
