import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders } from '@/lib/cors';

/** Shape returned for each delivery log entry. */
interface DeliveryLog {
  id: string;
  webhookConfigId: string | null;
  event: string;
  url: string;
  status: 'success' | 'failed' | 'pending';
  responseStatus: number | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

/** Maps a DB row to the typed DeliveryLog shape. */
function mapRowToLog(row: {
  id: string;
  webhook_config_id: string | null;
  event: string;
  url: string;
  status: 'success' | 'failed' | 'pending';
  response_status: number | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}): DeliveryLog {
  return {
    id: row.id,
    webhookConfigId: row.webhook_config_id,
    event: row.event,
    url: row.url,
    status: row.status,
    responseStatus: row.response_status,
    errorMessage: row.error_message,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

/**
 * GET /api/webhooks/deliveries
 *
 * Returns recent webhook delivery logs visible to the authenticated user.
 * Results are ordered newest-first.
 *
 * Query params (all optional):
 *   - webhookConfigId: filter to a specific webhook config
 *   - event: filter by event type (e.g. "lead.created")
 *   - status: filter by status ("success", "failed", "pending")
 *   - limit: max results (default 50, max 100)
 *   - offset: pagination offset (default 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    let user;
    try {
      const { data: { user: u }, error: authError } = await supabase.auth.getUser();
      if (authError || !u) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
      }
      user = u;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(user.id || 'anon:' + ip, 60, 60000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
    }

    // Parse query params
    const { searchParams } = request.nextUrl;
    const webhookConfigId = searchParams.get('webhookConfigId');
    const event = searchParams.get('event');
    const status = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);

    // Validate status filter if provided
    if (status && !['success', 'failed', 'pending'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter. Must be one of: success, failed, pending.' },
        { status: 400, headers: corsHeaders() },
      );
    }

    // Build the query
    let query = supabase
      .from('webhook_deliveries')
      .select('*', { count: 'exact' });

    // Apply filters
    if (webhookConfigId) {
      query = query.eq('webhook_config_id', webhookConfigId);
    }
    if (event) {
      query = query.eq('event', event);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const logs = (data ?? []).map(mapRowToLog);

    return NextResponse.json({
      data: logs,
      pagination: {
        total: count ?? logs.length,
        limit,
        offset,
        hasMore: (count ?? 0) > offset + limit,
      },
    }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
