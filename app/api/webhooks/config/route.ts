import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { webhookConfigService } from '@/services/webhook-config.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';
import { isPrivateHost } from '@/lib/ssrf';

/**
 * GET /api/webhooks/config
 *
 * Lists all webhook configurations for the authenticated user.
 * Results are ordered most-recent first via the service layer.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    let userId = '';
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) userId = u.id;
    } catch { /* auth unavailable — return empty list */ }

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(userId || 'anon:' + ip, 60, 60000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
    }

    const configs = await webhookConfigService.getAll();
    // SAFETY: Strip secret from API responses — secrets must never leave the server.
    const sanitized = configs.map(({ secret: _secret, ...rest }) => {
      void _secret; // secret is stripped from API responses
      return rest;
    });
    return NextResponse.json({ data: sanitized }, { headers: corsHeaders() });
  } catch (e) {
    console.error(`[webhooks/config] GET Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * POST /api/webhooks/config
 *
 * Creates a new webhook configuration.
 *
 * Body (JSON):
 *   - name: string (required) — display name
 *   - url: string (required) — target webhook URL
 *   - secret?: string — optional shared secret for bearer auth
 *   - events?: string[] — event types to subscribe to (empty = all events)
 *   - active?: boolean — whether the webhook is active (default: true)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders() });
    }

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Name is required and must be a non-empty string' }, { status: 400, headers: corsHeaders() });
    }
    if (!body.url || typeof body.url !== 'string' || !body.url.trim()) {
      return NextResponse.json({ error: 'URL is required and must be a non-empty string' }, { status: 400, headers: corsHeaders() });
    }

    // Validate URL format
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format. Must be a valid absolute URL.' }, { status: 400, headers: corsHeaders() });
    }

    // SSRF protection: reject private/internal hosts
    if (isPrivateHost(body.url)) {
      return NextResponse.json({ error: 'URL must point to a public endpoint' }, { status: 400, headers: corsHeaders() });
    }

    // Validate events array if provided
    if (body.events !== undefined && !Array.isArray(body.events)) {
      return NextResponse.json({ error: 'Events must be an array of strings' }, { status: 400, headers: corsHeaders() });
    }

    const config = await webhookConfigService.create({
      name: body.name as string,
      url: body.url as string,
      secret: typeof body.secret === 'string' ? body.secret : undefined,
      events: Array.isArray(body.events) ? body.events as string[] : undefined,
      active: typeof body.active === 'boolean' ? body.active : true,
    });

    // SAFETY: Strip secret from API responses — secrets must never leave the server.
    const { secret: _unused, ...sanitized } = config;
    void _unused;
    return NextResponse.json({ data: sanitized }, { status: 201, headers: corsHeaders() });
  } catch (e) {
    console.error(`[webhooks/config] POST Error:`, e);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
