import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { webhookConfigService } from '@/services/webhook-config.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';
import { isPrivateHost } from '@/lib/ssrf';

/**
 * GET /api/webhooks/config/[id]
 *
 * Returns a single webhook configuration by ID.
 * Returns 404 if the config does not exist or does not belong to the user.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
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

    const { id } = await params;
    const config = await webhookConfigService.getById(id, supabase);

    if (!config) {
      return NextResponse.json({ error: 'Webhook config not found' }, { status: 404, headers: corsHeaders() });
    }

    // ponytail: ownership check — prevents IDOR across users
    if (config.createdBy !== user.id) {
      return NextResponse.json({ error: 'Webhook config not found' }, { status: 404, headers: corsHeaders() });
    }

    // Strip secret from response — secrets must never leave the server (same as list endpoint)
    const { secret: _secret, ...sanitized } = config;
    void _secret;
    return NextResponse.json({ data: sanitized }, { headers: corsHeaders() });
  } catch (e) {
    console.error(`[webhooks/config/:id] GET Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * PUT /api/webhooks/config/[id]
 *
 * Updates an existing webhook configuration. Only the provided fields are changed.
 * Returns 404 if the config does not exist or does not belong to the user.
 *
 * Body (JSON, partial):
 *   - name?: string
 *   - url?: string
 *   - secret?: string | null
 *   - events?: string[] | null
 *   - active?: boolean
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1_048_576) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413, headers: corsHeaders() });
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

    const { id } = await params;

    // Check existence first
    const existing = await webhookConfigService.getById(id, supabase);
    if (!existing) {
      return NextResponse.json({ error: 'Webhook config not found' }, { status: 404, headers: corsHeaders() });
    }

    // ponytail: ownership check — prevents IDOR across users
    if (existing.createdBy !== user.id) {
      return NextResponse.json({ error: 'Webhook config not found' }, { status: 404, headers: corsHeaders() });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders() });
    }

    // Validate fields if provided
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400, headers: corsHeaders() });
    }
    if (body.url !== undefined) {
      if (typeof body.url !== 'string' || !body.url.trim()) {
        return NextResponse.json({ error: 'URL must be a non-empty string' }, { status: 400, headers: corsHeaders() });
      }
      try {
        new URL(body.url);
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400, headers: corsHeaders() });
      }

      // SSRF protection: reject private/internal hosts
      if (isPrivateHost(body.url)) {
        return NextResponse.json({ error: 'URL must point to a public endpoint' }, { status: 400, headers: corsHeaders() });
      }
    }
    if (body.events !== undefined && body.events !== null && !Array.isArray(body.events)) {
      return NextResponse.json({ error: 'Events must be an array of strings or null' }, { status: 400, headers: corsHeaders() });
    }
    if (body.active !== undefined && typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'Active must be a boolean' }, { status: 400, headers: corsHeaders() });
    }

    const updated = await webhookConfigService.update(id, {
      name: body.name !== undefined ? (body.name as string) : undefined,
      url: body.url !== undefined ? (body.url as string) : undefined,
      secret: body.secret !== undefined ? (body.secret as string | undefined) : undefined,
      events: body.events !== undefined ? (body.events as string[] | undefined) : undefined,
      active: body.active !== undefined ? (body.active as boolean) : undefined,
    }, supabase);

    return NextResponse.json({ data: updated }, { headers: corsHeaders() });
  } catch (e) {
    console.error(`[webhooks/config/:id] PUT Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * DELETE /api/webhooks/config/[id]
 *
 * Deletes a webhook configuration.
 * Returns 404 if the config does not exist or does not belong to the user.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
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

    const { id } = await params;

    // Check existence first
    const existing = await webhookConfigService.getById(id, supabase);
    if (!existing) {
      return NextResponse.json({ error: 'Webhook config not found' }, { status: 404, headers: corsHeaders() });
    }

    // ponytail: ownership check — prevents IDOR across users
    if (existing.createdBy !== user.id) {
      return NextResponse.json({ error: 'Webhook config not found' }, { status: 404, headers: corsHeaders() });
    }

    await webhookConfigService.delete(id, supabase);
    return NextResponse.json({ data: { id }, success: true }, { headers: corsHeaders() });
  } catch (e) {
    console.error(`[webhooks/config/:id] DELETE Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
