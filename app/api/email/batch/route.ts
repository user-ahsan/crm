import { NextRequest, NextResponse } from 'next/server';
import { communicationService } from '@/services/communication.service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';

/**
 * ─── Email Batch Send Route ──────────────────────────────────────────
 *
 * POST /api/email/batch
 *
 * Accepts an array of email objects and sends each one sequentially via
 * the service layer. Each email is processed independently so one failure
 * does not affect the others.
 *
 * Body (JSON):
 *   - emails: Array<{
 *       toAddress: string       — recipient email (required)
 *       subject: string         — email subject (required)
 *       body: string            — email body (required)
 *       relatedToType?: string  — entity type
 *       relatedToId?: string    — entity ID
 *     }>
 *
 * Returns 200 with per-email results array.
 * Returns 400 for missing/invalid body.
 * Returns 500 on unexpected service errors.
 * ─────────────────────────────────────────────────────────────────────
 */

/** A single email entry in the batch request. */
interface BatchEmailEntry {
  toAddress: string;
  subject: string;
  body: string;
  relatedToType?: string;
  relatedToId?: string;
}

/** Request body shape. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BatchRequestBody {
  emails: BatchEmailEntry[];
}

/** Result for one email in the batch. */
interface BatchEmailResult {
  toAddress: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Batch response shape. */
interface BatchResponse {
  results: BatchEmailResult[];
}

/** Error response shape. */
interface BatchErrorResponse {
  success: false;
  error: string;
}

type BatchApiResponse = BatchResponse | BatchErrorResponse;

// ── Helpers ───────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['toAddress', 'subject', 'body'] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a single batch email entry. Returns an error string if
 * invalid, or null if valid.
 */
function validateBatchEntry(entry: Record<string, unknown>, index: number): string | null {
  for (const field of REQUIRED_FIELDS) {
    const value = entry[field];
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      return `Entry ${index}: missing or empty '${field}'`;
    }
  }
  const toAddress = (entry.toAddress as string).trim();
  if (!EMAIL_PATTERN.test(toAddress)) {
    return `Entry ${index}: invalid toAddress '${toAddress}'`;
  }
  return null;
}

/**
 * Extracts a validated BatchEmailEntry from a raw object, or returns
 * null with a pre-filled error result.
 */
function parseBatchEntry(raw: unknown, index: number): { entry: BatchEmailEntry | null; result: BatchEmailResult | null } {
  if (typeof raw !== 'object' || raw === null) {
    return {
      entry: null,
      result: { toAddress: `entry-${index}`, success: false, error: `Entry ${index}: not a valid object` },
    };
  }

  const obj = raw as Record<string, unknown>;
  const validationError = validateBatchEntry(obj, index);
  if (validationError) {
    const address = typeof obj.toAddress === 'string' ? obj.toAddress.trim() : `entry-${index}`;
    return {
      entry: null,
      result: { toAddress: address, success: false, error: validationError },
    };
  }

  return {
    entry: {
      toAddress: (obj.toAddress as string).trim(),
      subject: (obj.subject as string).trim(),
      body: (obj.body as string).trim(),
      relatedToType: typeof obj.relatedToType === 'string' ? obj.relatedToType.trim() : undefined,
      relatedToId: typeof obj.relatedToId === 'string' ? obj.relatedToId.trim() : undefined,
    },
    result: null,
  };
}

// ── Route Handler ─────────────────────────────────────────────────────

/**
 * POST /api/email/batch
 *
 * Sends multiple emails sequentially. Invalid entries are rejected with
 * their own error result rather than failing the entire batch.
 */
export async function POST(request: NextRequest): Promise<NextResponse<BatchApiResponse>> {
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

  // Validate emails array
  const rawEmails = body.emails;
  if (!Array.isArray(rawEmails) || rawEmails.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Missing or empty emails array' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Limit batch size
  if (rawEmails.length > 100) {
    return NextResponse.json(
      { success: false, error: 'Max 100 emails per batch' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Parse and validate all entries upfront
  const validEntries: BatchEmailEntry[] = [];
  const results: BatchEmailResult[] = [];

  for (let i = 0; i < rawEmails.length; i++) {
    const { entry, result } = parseBatchEntry(rawEmails[i], i);
    if (entry) {
      validEntries.push(entry);
    } else if (result) {
      results.push(result);
    }
  }

  // Nothing valid to send
  if (validEntries.length === 0) {
    return NextResponse.json({ results }, { status: 200, headers: corsHeaders() });
  }

  // Delegate batch to service
  try {
    const serviceResults = await communicationService.sendBatchEmails(validEntries);
    results.push(...serviceResults);

    return NextResponse.json({ results }, { status: 200, headers: corsHeaders() });
  } catch (e) {
    console.error(`[email/batch] Error:`, e);
    return NextResponse.json(
      { success: false, error: 'An internal error occurred' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
