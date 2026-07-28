import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { campaignScheduler } from '@/services/campaign-scheduler.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';

/**
 * ─── Campaign Process Route (Cron Webhook) ──────────────────────────
 *
 * POST /api/campaigns/process
 *
 * Triggered by an external scheduler (Vercel Cron Jobs, GitHub Actions,
 * Supabase pg_cron, or any cron service). Processes all pending campaign
 * email sends whose scheduled_send_at has passed.
 *
 * This is the single trigger point for campaign delivery. It requires
 * authentication so it cannot be called anonymously, but is designed to
 * be invoked by a service account or API key.
 *
 * Response: { sent: number, failed: number }
 *
 * Returns 401 if unauthenticated.
 * Returns 500 on service failure.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Process response shape. */
interface ProcessSuccessResponse {
  sent: number;
  failed: number;
}

/** Error response shape. */
interface ProcessErrorResponse {
  success: false;
  error: string;
}

type ProcessResponse = ProcessSuccessResponse | ProcessErrorResponse;

// ── Route Handler ─────────────────────────────────────────────────────

/**
 * POST /api/campaigns/process
 *
 * Authenticates the request, then delegates to the scheduler service to
 * find and deliver all pending campaign emails that are due.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ProcessResponse>> {
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1_048_576) {
    return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413, headers: corsHeaders() });
  }

  // Accept either cron API key (CRON_SECRET) or browser session
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  let userId = 'cron';
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Service-role auth for cron jobs — skip user auth
  } else {
    // ── CSRF / Origin check for user-authenticated requests ─────
    // (cron requests with CRON_SECRET are exempt since they come
    //  from server-side schedulers that don't have a browser origin)
    if (!validateCsrf(request)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403, headers: corsHeaders() },
      );
    }

    // Normal user auth
    const supabase = await createServerSupabaseClient();
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401, headers: corsHeaders() },
        );
      }
      userId = user.id;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders() },
      );
    }
  }

  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(userId || 'anon:' + ip, 60, 60000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
  }

  try {
    const result = await campaignScheduler.processPendingSends();

    return NextResponse.json(
      { sent: result.sent, failed: result.failed },
      { status: 200, headers: corsHeaders() },
    );
  } catch (e) {
    console.error(`[campaigns/process] Error:`, e);
    return NextResponse.json(
      { success: false, error: 'An internal error occurred' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
