import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { campaignService } from '@/services/campaign.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';
import type {
  EmailSequence,
  CampaignStatus,
} from '@/types/campaign.types';

// ── Types ─────────────────────────────────────────────────────

interface SequenceWithStats extends EmailSequence {
  stats: {
    emailCount: number;
    recipientCount: number;
  };
}

interface GetSuccess {
  sequences: SequenceWithStats[];
}

interface CreateSuccess {
  sequence: EmailSequence;
}

interface ErrorResponse {
  error: string;
}

type GetResponse = GetSuccess | ErrorResponse;
type CreateResponse = CreateSuccess | ErrorResponse;

// ── Validation ────────────────────────────────────────────────

const VALID_STATUSES: CampaignStatus[] = [
  'draft',
  'active',
  'paused',
  'completed',
];

function validateSequenceBody(
  body: Record<string, unknown>,
): { name: string; description: string; status: CampaignStatus } | string {
  const name = body.name;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return 'Name is required';
  }

  const description =
    typeof body.description === 'string' ? body.description.trim() : '';

  let status: CampaignStatus = 'draft';
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status as CampaignStatus)) {
      return `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`;
    }
    status = body.status as CampaignStatus;
  }

  return { name: name.trim(), description, status };
}

// ── Route Handlers ────────────────────────────────────────────

/**
 * GET /api/campaigns
 *
 * Lists all email sequences for the current user with per-sequence
 * email count and total recipient count. Results are ordered newest first.
 */
export async function GET(request: NextRequest): Promise<NextResponse<GetResponse>> {
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

    const sequences = await campaignService.getSequences();

    // Enrich each sequence with email count and recipient count
    const sequencesWithStats = await Promise.all(
      sequences.map(async (seq) => {
        const emails = await campaignService.getCampaignEmails(seq.id);

        const { count: recipientCount, error: countError } = await supabase
          .from('campaign_recipients')
          .select('*', { count: 'exact', head: true })
          .eq('sequence_id', seq.id);

        return {
          ...seq,
          stats: {
            emailCount: emails.length,
            recipientCount: countError ? 0 : (recipientCount ?? 0),
          },
        };
      }),
    );

    return NextResponse.json({ sequences: sequencesWithStats }, { headers: corsHeaders() });
  } catch (e) {
    console.error(`[campaigns] GET Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * POST /api/campaigns
 *
 * Creates a new email sequence (campaign).
 *
 * Body: { name: string; description?: string; status?: CampaignStatus }
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<CreateResponse>> {
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

  const validated = validateSequenceBody(body);
  if (typeof validated === 'string') {
    return NextResponse.json({ error: validated }, { status: 400, headers: corsHeaders() });
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

    const sequence = await campaignService.createSequence({
      name: validated.name,
      description: validated.description,
      status: validated.status,
    });

    return NextResponse.json({ sequence }, { status: 201, headers: corsHeaders() });
  } catch (e) {
    console.error(`[campaigns] POST Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
