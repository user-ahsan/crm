import { NextRequest, NextResponse } from 'next/server';
import { communicationService } from '@/services/communication.service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';
import type { EmailFormData } from '@/types/communication.types';

/**
 * ─── Email Send Route ────────────────────────────────────────────────
 *
 * POST /api/email/send
 *
 * Accepts email data, validates required fields, and delegates to the
 * service layer which handles both the Resend API call and database
 * persistence.
 *
 * Body (JSON):
 *   - toAddress: string       — recipient email address (required)
 *   - subject: string         — email subject line (required)
 *   - body: string            — email body text (required)
 *   - relatedToType?: string  — entity type (lead, contact, company)
 *   - relatedToId?: string    — entity ID
 *
 * Returns 200 with email data on success.
 * Returns 400 for missing/invalid fields.
 * Returns 500 on service failure.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Shape of a valid send request. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SendEmailBody {
  toAddress: string;
  subject: string;
  body: string;
  relatedToType?: string;
  relatedToId?: string;
}

/** Success response. */
interface SendSuccessResponse {
  success: true;
  emailId: string;
  providerMessageId?: string;
  status: string;
}

/** Error response. */
interface SendErrorResponse {
  success: false;
  error: string;
}

type SendResponse = SendSuccessResponse | SendErrorResponse;

// ── Helpers ───────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['toAddress', 'subject', 'body'] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the request body contains all required fields with non-empty
 * string values. Returns a list of missing field names, empty if valid.
 */
function validateSendBody(body: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const value = body[field];
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      missing.push(field);
    }
  }
  return missing;
}

// ── Route Handler ─────────────────────────────────────────────────────

/**
 * POST /api/email/send
 *
 * Sends a single email via the communication service. The service handles
 * the Resend API call, database persistence, activity logging, and
 * webhook dispatch.
 */
export async function POST(request: NextRequest): Promise<NextResponse<SendResponse>> {
  // Body size limit
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1024 * 1024) { // 1MB limit
    return NextResponse.json(
      { success: false, error: 'Request too large' },
      { status: 413, headers: corsHeaders() },
    );
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

  // Validate required fields
  const missingFields = validateSendBody(body);
  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
      },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Validate toAddress format (proper email regex)
  const toAddress = (body.toAddress as string).trim();
  if (!EMAIL_PATTERN.test(toAddress)) {
    return NextResponse.json(
      { success: false, error: 'Invalid toAddress: must be a valid email' },
      { status: 400, headers: corsHeaders() },
    );
  }

  const emailData: EmailFormData = {
    toAddress,
    subject: (body.subject as string).trim(),
    body: (body.body as string).trim(),
    relatedToType: typeof body.relatedToType === 'string' ? body.relatedToType.trim() : undefined,
    relatedToId: typeof body.relatedToId === 'string' ? body.relatedToId.trim() : undefined,
  };

  // Delegate to service
  try {
    const email = await communicationService.sendEmail(emailData);

    if (email.status === 'sent') {
      return NextResponse.json(
        { success: true, emailId: email.id, providerMessageId: email.providerMessageId, status: email.status },
        { status: 200, headers: corsHeaders() },
      );
    }
    return NextResponse.json(
      { success: false, error: email.errorMessage || 'Email delivery pending — check status later' },
      { status: 202, headers: corsHeaders() },
    );
  } catch (e) {
    console.error(`[email/send] Error:`, e);
    return NextResponse.json(
      { success: false, error: 'An internal error occurred' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
