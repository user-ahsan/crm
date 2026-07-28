/**
 * ─── Campaign Cron Process Route ──────────────────────────────────────
 *
 * POST /api/campaigns/cron/process
 *
 * Triggered by Vercel Cron Jobs (vercel.json schedule). Calls
 * campaignScheduler.processPendingSends() to deliver all pending
 * campaign emails whose scheduled_send_at has passed.
 *
 * Protected by CRON_SECRET environment variable via Authorization header.
 * This endpoint is NOT user-authenticated — it uses a shared secret
 * that should be set as an environment variable in the deployment.
 *
 * Response: { sent: number, failed: number }
 * Returns 401 if CRON_SECRET is missing or invalid.
 * Returns 500 on service failure.
 * ─────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { campaignScheduler } from '@/services/campaign-scheduler.service';
import { corsHeaders } from '@/lib/cors';
import { withFeatureGate } from '@/lib/feature-gates';

/** Success response shape. */
interface CronSuccessResponse {
  sent: number;
  failed: number;
}

/** Error response shape. */
interface CronErrorResponse {
  success: false;
  error: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CronResponse = CronSuccessResponse | CronErrorResponse;

// ── Route Handler ─────────────────────────────────────────────────────

/**
 * POST /api/campaigns/cron/process
 *
 * Validates the CRON_SECRET authorization, then processes all pending
 * campaign sends. Designed to be called by Vercel Cron Jobs or any
 * external scheduler.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  // Feature gate: email_sequences must be enabled
  const gate = withFeatureGate('email_sequences');
  if (gate) return gate;

  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1_048_576) {
    return NextResponse.json(
      { success: false, error: 'Request too large' },
      { status: 413, headers: corsHeaders() },
    );
  }

  // ── Auth: CRON_SECRET ─────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET not configured on server' },
      { status: 500, headers: corsHeaders() },
    );
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — invalid or missing CRON_SECRET' },
      { status: 401, headers: corsHeaders() },
    );
  }

  // ── Process pending sends ──────────────────────────────────────
  try {
    const result = await campaignScheduler.processPendingSends();

    return NextResponse.json(
      { sent: result.sent, failed: result.failed },
      { status: 200, headers: corsHeaders() },
    );
  } catch (e) {
    console.error('[campaigns/cron/process] Error:', e);
    return NextResponse.json(
      { success: false, error: 'An internal error occurred while processing campaign sends' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
