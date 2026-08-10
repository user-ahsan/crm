import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { campaignScheduler } from '@/services/campaign-scheduler.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders } from '@/lib/cors';

/**
 * ─── Campaign Stats Route ────────────────────────────────────────────
 *
 * GET /api/campaigns/[id]/stats
 *
 * Returns delivery statistics for a campaign sequence: how many
 * recipients were queued, how many emails have been sent, how many
 * failed, and how many are still pending.
 *
 * Path params:
 *   - id: The email_sequence UUID
 *
 * Response: { total, sent, failed, pending }
 *
 * Returns 401 if unauthenticated.
 * Returns 404 if the sequence does not exist.
 * Returns 500 on service failure.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Stats response shape. */
interface StatsSuccessResponse {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  processing: number;
}

/** Error response shape. */
interface StatsErrorResponse {
  success: false;
  error: string;
}

type StatsResponse = StatsSuccessResponse | StatsErrorResponse;

// ── Route Handler ─────────────────────────────────────────────────────

/**
 * GET /api/campaigns/[id]/stats
 *
 * Authenticates the request and fetches delivery stats for the given
 * sequence ID. Returns 404 if the sequence does not exist.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<StatsResponse>> {
  try {
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

    const { id } = await params;

    // Verify the sequence exists
    const { data: sequence, error: seqError } = await supabase
      .from('email_sequences')
      .select('id, created_by')
      .eq('id', id)
      .single<{ id: string; created_by: string }>();

    if (seqError || !sequence) {
      return NextResponse.json(
        { success: false, error: 'Campaign sequence not found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    // ponytail: ownership check — prevents IDOR across users
    if (sequence.created_by !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Campaign sequence not found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    const stats = await campaignScheduler.getSequenceStats(id);

    return NextResponse.json(
      {
        total: stats.total,
        sent: stats.sent,
        failed: stats.failed,
        pending: stats.pending,
        processing: stats.processing,
      },
      { status: 200, headers: corsHeaders() },
    );
  } catch (e) {
    console.error(`[campaigns/stats] Error:`, e);
    return NextResponse.json(
      { success: false, error: 'An internal error occurred' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
