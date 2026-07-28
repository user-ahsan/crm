import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';
import { URL } from 'url';

function isPrivateHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    // Reject localhost/loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local')) {
      return true;
    }

    // Reject private IP ranges
    const parts = hostname.split('.');
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
      const first = parseInt(parts[0], 10);
      const second = parseInt(parts[1], 10);
      if (first === 10) return true;
      if (first === 172 && second >= 16 && second <= 31) return true;
      if (first === 192 && second === 168) return true;
      if (first === 169 && second === 254) return true; // link-local
      if (first === 100 && second >= 64 && second <= 127) return true; // CG-NAT
    }

    // Reject metadata IPs
    if (hostname === '169.254.169.254') return true;

    return false;
  } catch {
    return true; // reject if URL is invalid
  }
}

/**
 * POST /api/webhooks/test
 *
 * Sends a test webhook ping to a specified URL to verify connectivity.
 * Uses the same fetch pattern as the internal webhook service.
 *
 * Body (JSON):
 *   - url: string (required) — target webhook URL to test
 *   - secret?: string — optional shared secret for bearer auth
 *
 * Response (200):
 *   - success: boolean — whether the delivery succeeded (2xx)
 *   - statusCode: number | null — HTTP status code returned
 *   - durationMs: number — round-trip time in milliseconds
 *   - error: string | null — error message on failure
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1_048_576) {
    return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413, headers: corsHeaders() });
  }

  // ── CSRF / Origin check ───────────────────────────────────────
  if (!validateCsrf(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  try {
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

    let body: { url?: string; secret?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders() });
    }

    // Validate URL
    if (!body.url || typeof body.url !== 'string' || !body.url.trim()) {
      return NextResponse.json({ error: 'URL is required and must be a non-empty string' }, { status: 400, headers: corsHeaders() });
    }
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format. Must be a valid absolute URL.' }, { status: 400, headers: corsHeaders() });
    }

    // SSRF protection: reject private/internal hosts
    if (isPrivateHost(body.url)) {
      return NextResponse.json({ success: false, error: 'URL must point to a public endpoint' }, { status: 400, headers: corsHeaders() });
    }

    const secret = typeof body.secret === 'string' && body.secret.trim()
      ? body.secret.trim()
      : null;

    // Direct fetch to the test URL (same pattern as sendToUrl in webhook.service.ts)
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (secret) {
        headers['Authorization'] = `Bearer ${secret}`;
      }

      const response = await fetch(body.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event: 'test.ping',
          timestamp: new Date().toISOString(),
          data: {
            test: true,
            triggeredBy: user.id,
          },
          metadata: { source: 'webhook-test-ui' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const durationMs = Math.round(performance.now() - startTime);

      return NextResponse.json({
        success: response.ok,
        statusCode: response.status,
        durationMs,
        error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
      }, { headers: corsHeaders() });
    } catch (fetchError) {
      const durationMs = Math.round(performance.now() - startTime);
      console.error(`[webhooks/test] Network error:`, fetchError);

      return NextResponse.json({
        success: false,
        statusCode: null,
        durationMs,
        error: `Network error: Connection failed`,
      }, { headers: corsHeaders() });
    }
  } catch (e) {
    console.error(`[webhooks/test] Error:`, e);
    return NextResponse.json({ success: false, error: 'An internal error occurred' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
