import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { campaignService } from '@/services/campaign.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';
import type {
  EmailSequence,
  CampaignEmail,
  CampaignStatus,
} from '@/types/campaign.types';

// ── Response Types ────────────────────────────────────────────

interface SequenceWithEmails extends EmailSequence {
  emails: CampaignEmail[];
  stats: {
    totalRecipients: number;
    sentRecipients: number;
    pendingRecipients: number;
    failedRecipients: number;
  };
}

interface GetSuccess {
  sequence: SequenceWithEmails;
}

interface UpdateSuccess {
  sequence: EmailSequence;
}

interface DeleteSuccess {
  deleted: true;
}

interface ErrorResponse {
  error: string;
}

type GetResponse = GetSuccess | ErrorResponse;
type UpdateResponse = UpdateSuccess | ErrorResponse;
type DeleteResponse = DeleteSuccess | ErrorResponse;

// ── Route Handlers ────────────────────────────────────────────

/**
 * GET /api/campaigns/[id]
 *
 * Returns a single email sequence with its campaign emails and
 * aggregate recipient statistics. Only accessible to the sequence
 * owner (via RLS).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<GetResponse>> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Sequence ID is required' }, { status: 400, headers: corsHeaders() });
  }

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

    // Fetch the sequence
    const sequence = await campaignService.getSequence(id);
    if (!sequence) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    // ponytail: ownership check — prevents IDOR across users
    if (sequence.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    // Fetch campaign emails in parallel
    const emails = await campaignService.getCampaignEmails(id);

    // Fetch recipient statistics
    const { data: stats, error: statsError } = await supabase
      .from('campaign_recipients')
      .select('status')
      .eq('sequence_id', id);

    if (statsError) {
      return NextResponse.json(
        { error: 'An internal error occurred' },
        { status: 500, headers: corsHeaders() },
      );
    }

    const totalRecipients = stats?.length ?? 0;
    const sentRecipients =
      stats?.filter((r: { status: string }) => r.status === 'sent').length ?? 0;
    const pendingRecipients =
      stats?.filter((r: { status: string }) => r.status === 'pending').length ?? 0;
    const failedRecipients =
      stats?.filter((r: { status: string }) => r.status === 'failed').length ?? 0;

    return NextResponse.json({
      sequence: {
        ...sequence,
        emails,
        stats: {
          totalRecipients,
          sentRecipients,
          pendingRecipients,
          failedRecipients,
        },
      },
    }, { headers: corsHeaders() });
  } catch (e) {
    console.error(`[campaigns/:id] GET Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * PUT /api/campaigns/[id]
 *
 * Updates the sequence name, description, or status.
 * Only mutable fields are accepted — id, createdBy, timestamps are ignored.
 *
 * Body (partial): { name?, description?, status? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<UpdateResponse>> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Sequence ID is required' }, { status: 400, headers: corsHeaders() });
  }

  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1_048_576) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413, headers: corsHeaders() });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // ── CSRF / Origin check ───────────────────────────────────────
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

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

    // Verify sequence exists
    const existing = await campaignService.getSequence(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    // ponytail: ownership check — prevents IDOR across users
    if (existing.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    // Validate status if provided
    if (body.status !== undefined) {
      const validStatuses: CampaignStatus[] = [
        'draft',
        'active',
        'paused',
        'completed',
      ];
      if (!validStatuses.includes(body.status as CampaignStatus)) {
        return NextResponse.json(
          {
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          },
          { status: 400, headers: corsHeaders() },
        );
      }
    }

    // Build update payload — only known fields
    const updateData: { name?: string; description?: string; status?: CampaignStatus } = {};
    if (typeof body.name === 'string' && body.name.trim()) {
      updateData.name = body.name.trim();
    }
    if (typeof body.description === 'string') {
      updateData.description = body.description.trim();
    }
    if (body.status !== undefined) {
      updateData.status = body.status as CampaignStatus;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const updated = await campaignService.updateSequence(id, updateData);
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update sequence' },
        { status: 500, headers: corsHeaders() },
      );
    }

    return NextResponse.json({ sequence: updated }, { headers: corsHeaders() });
  } catch (e) {
    console.error(`[campaigns/:id] PUT Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * DELETE /api/campaigns/[id]
 *
 * Deletes the email sequence and cascade-deletes all associated
 * campaign emails and recipients (handled by DB foreign-key CASCADE).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<DeleteResponse>> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Sequence ID is required' }, { status: 400, headers: corsHeaders() });
  }

  // ── CSRF / Origin check ───────────────────────────────────────
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

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

    // Verify sequence exists
    const existing = await campaignService.getSequence(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    // ponytail: ownership check — prevents IDOR across users
    if (existing.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    const ok = await campaignService.deleteSequence(id);
    if (!ok) {
      return NextResponse.json(
        { error: 'Failed to delete sequence' },
        { status: 500, headers: corsHeaders() },
      );
    }

    return NextResponse.json({ deleted: true }, { headers: corsHeaders() });
  } catch (e) {
    console.error(`[campaigns/:id] DELETE Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
