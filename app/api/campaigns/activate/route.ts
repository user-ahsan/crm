import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { campaignScheduler } from '@/services/campaign-scheduler.service';
import { campaignService } from '@/services/campaign.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ─── Campaign Activate Route ─────────────────────────────────────────
 *
 * POST /api/campaigns/activate
 *
 * Activates an email sequence and queues all recipients for delivery.
 * Optionally filters the target list to specific leads and/or contacts;
 * if neither is provided the caller should have already pre-qualified
 * the list elsewhere.
 *
 * Body (JSON):
 *   - sequenceId: string       — the email_sequence to activate (required)
 *   - leadIds?: string[]       — specific leads to include
 *   - contactIds?: string[]    — specific contacts to include
 *
 * Returns 200 with total queued count.
 * Returns 400 for missing/invalid fields.
 * Returns 401 if unauthenticated.
 * Returns 500 on service failure.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Shape of a valid activate request. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ActivateBody {
  sequenceId: string;
  leadIds?: string[];
  contactIds?: string[];
}

/** Success response. */
interface ActivateSuccessResponse {
  success: true;
  total: number;
}

/** Error response. */
interface ActivateErrorResponse {
  success: false;
  error: string;
}

type ActivateResponse = ActivateSuccessResponse | ActivateErrorResponse;

// ── Route Handler ─────────────────────────────────────────────────────

/**
 * POST /api/campaigns/activate
 *
 * Validates the request, checks authentication, and delegates to the
 * campaign scheduler service to mark the sequence active and create
 * recipient rows.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ActivateResponse>> {
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1_048_576) {
    return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413, headers: corsHeaders() });
  }

  // ── CSRF / Origin check ───────────────────────────────────────
  if (!validateCsrf(request)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403, headers: corsHeaders() },
    );
  }

  // Authenticate
  const supabase = await createServerSupabaseClient();
  let user;
  try {
    const { data: { user: u }, error: authError } = await supabase.auth.getUser();
    if (authError || !u) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders() },
      );
    }
    user = u;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: corsHeaders() },
    );
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
  const sequenceId = body.sequenceId;
  if (!sequenceId || typeof sequenceId !== 'string' || !sequenceId.trim()) {
    return NextResponse.json(
      { success: false, error: 'Missing required field: sequenceId' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Verify the sequence exists and is in draft status
  const sequence = await campaignService.getSequence(sequenceId.trim());
  if (!sequence) {
    return NextResponse.json(
      { success: false, error: 'Sequence not found' },
      { status: 404, headers: corsHeaders() },
    );
  }
  if (sequence.status !== 'draft') {
    return NextResponse.json(
      { success: false, error: 'Can only activate draft sequences' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Validate optional arrays — filter to valid UUIDs only
  const leadIds: string[] | undefined = Array.isArray(body.leadIds)
    ? (body.leadIds as string[]).filter((id) => typeof id === 'string' && UUID_PATTERN.test(id.trim()))
    : undefined;

  const contactIds: string[] | undefined = Array.isArray(body.contactIds)
    ? (body.contactIds as string[]).filter((id) => typeof id === 'string' && UUID_PATTERN.test(id.trim()))
    : undefined;

  if ((!leadIds || leadIds.length === 0) && (!contactIds || contactIds.length === 0)) {
    return NextResponse.json(
      { success: false, error: 'At least one lead or contact ID is required' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Delegate to scheduler
  try {
    const result = await campaignScheduler.activateSequence(
      sequenceId.trim(),
      leadIds,
      contactIds,
    );

    return NextResponse.json(
      { success: true, total: result.total },
      { status: 200, headers: corsHeaders() },
    );
  } catch (e) {
    console.error(`[campaigns/activate] Error:`, e);
    return NextResponse.json(
      { success: false, error: 'An internal error occurred' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
