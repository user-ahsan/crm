import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { campaignService } from '@/services/campaign.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders } from '@/lib/cors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Response Types ────────────────────────────────────────────

interface RecipientResponse {
  id: string;
  recipientEmail: string;
  recipientType: string;
  status: string;
  scheduledSendAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
}

interface GetRecipientsSuccess {
  recipients: RecipientResponse[];
}

interface AddRecipientsSuccess {
  added: number;
}

interface ErrorResponse {
  error: string;
}

type GetResponse = GetRecipientsSuccess | ErrorResponse;
type PostResponse = AddRecipientsSuccess | ErrorResponse;

// ── Helpers ───────────────────────────────────────────────────

/**
 * Maps a raw DB row to the API response shape.
 */
function mapRecipientRow(row: {
  id: string;
  recipient_email: string;
  recipient_type: string;
  status: string;
  scheduled_send_at: string | null;
  sent_at: string | null;
  error_message: string | null;
}): RecipientResponse {
  return {
    id: row.id,
    recipientEmail: row.recipient_email,
    recipientType: row.recipient_type,
    status: row.status,
    scheduledSendAt: row.scheduled_send_at,
    sentAt: row.sent_at,
    errorMessage: row.error_message,
  };
}

// ── Route Handlers ────────────────────────────────────────────

/**
 * GET /api/campaigns/recipients?sequenceId=xxx
 *
 * Returns all recipients for a given email sequence with their
 * current delivery status. Requires the caller to own the sequence.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<GetResponse>> {
  const { searchParams } = new URL(request.url);
  const sequenceId = searchParams.get('sequenceId');

  if (!sequenceId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: sequenceId' },
      { status: 400, headers: corsHeaders() },
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    let user;
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
      }
      user = session.session.user;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(user.id || 'anon:' + ip, 60, 60000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
    }

    // Verify the caller owns this sequence
    const sequence = await campaignService.getSequence(sequenceId);
    if (!sequence) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    // Fetch recipients (RLS policy gates on sequence ownership)
    const { data, error } = await supabase
      .from('campaign_recipients')
      .select(
        'id, recipient_email, recipient_type, status, scheduled_send_at, sent_at, error_message',
      )
      .eq('sequence_id', sequenceId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'An internal error occurred' },
        { status: 500, headers: corsHeaders() },
      );
    }

    return NextResponse.json({
      recipients: (data ?? []).map(mapRecipientRow),
    }, { headers: corsHeaders() });
  } catch (e) {
    console.error(`[campaigns/recipients] GET Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * POST /api/campaigns/recipients
 *
 * Adds leads and/or contacts as recipients of a campaign sequence.
 * Deduplicates by (sequence_id, recipient_type, recipient_id) so
 * re-adding the same person is safe.
 *
 * Body: { sequenceId, leadIds?: string[], contactIds?: string[] }
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<PostResponse>> {
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

  const sequenceId = body.sequenceId as string | undefined;
  if (!sequenceId || typeof sequenceId !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: sequenceId' },
      { status: 400, headers: corsHeaders() },
    );
  }

  const rawLeadIds = body.leadIds as string[] | undefined;
  const rawContactIds = body.contactIds as string[] | undefined;

  // Filter to valid UUIDs only
  const leadIds = Array.isArray(rawLeadIds) ? rawLeadIds.filter((id) => UUID_PATTERN.test(id)) : undefined;
  const contactIds = Array.isArray(rawContactIds) ? rawContactIds.filter((id) => UUID_PATTERN.test(id)) : undefined;

  if (
    (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) &&
    (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0)
  ) {
    return NextResponse.json(
      { error: 'Provide at least one leadId or contactId' },
      { status: 400, headers: corsHeaders() },
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    let user;
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
      }
      user = session.session.user;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(user.id || 'anon:' + ip, 60, 60000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
    }

    // Fetch the sequence to verify it exists (RLS also gates on ownership)
    const sequence = await campaignService.getSequence(sequenceId);
    if (!sequence) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    // Fetch email addresses for leads and contacts in one pass
    const emails: Array<{
      recipient_type: string;
      recipient_id: string;
      recipient_email: string;
    }> = [];

    if (leadIds && leadIds.length > 0) {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, email')
        .in('id', leadIds)
        .returns<Array<{ id: string; email: string | null }>>();

      for (const lead of leads ?? []) {
        if (lead.email) {
          emails.push({
            recipient_type: 'lead',
            recipient_id: lead.id,
            recipient_email: lead.email,
          });
        }
      }
    }

    if (contactIds && contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, email')
        .in('id', contactIds)
        .returns<Array<{ id: string; email: string | null }>>();

      for (const contact of contacts ?? []) {
        if (contact.email) {
          emails.push({
            recipient_type: 'contact',
            recipient_id: contact.id,
            recipient_email: contact.email,
          });
        }
      }
    }

    if (emails.length === 0) {
      return NextResponse.json(
        { error: 'None of the provided leads or contacts have an email address' },
        { status: 400, headers: corsHeaders() },
      );
    }

    // Upsert recipients (skip duplicates on sequence_id + recipient_type + recipient_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error } = await (supabase.from('campaign_recipients') as any).upsert(
        emails.map((e) => ({
          sequence_id: sequenceId,
          recipient_type: e.recipient_type,
          recipient_id: e.recipient_id,
          recipient_email: e.recipient_email,
          status: 'pending',
        })),
        {
          onConflict: 'sequence_id, recipient_type, recipient_id',
          ignoreDuplicates: true,
        },
      )
      .select('id');

    if (error) {
      return NextResponse.json(
        { error: 'An internal error occurred' },
        { status: 500, headers: corsHeaders() },
      );
    }

    return NextResponse.json({ added: inserted?.length ?? 0 }, { headers: corsHeaders() });
  } catch (e) {
    console.error(`[campaigns/recipients] POST Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
