import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders } from '@/lib/cors';

/**
 * ─── SMS Config Route ──────────────────────────────────────────────────
 *
 * GET /api/sms/config
 *
 * Returns whether Twilio environment variables are configured, with
 * masked values for display in the settings UI. Secrets are never
 * fully exposed — only the first few characters of Account SID are shown.
 *
 * Response (200):
 *   - configured: boolean       — true if both SID and token are set
 *   - accountSid: string|null   — masked SID (e.g. "AC••••••••••"), null if unset
 *   - fromNumber: string|null   — the configured sender number, null if unset
 * ───────────────────────────────────────────────────────────────────────
 */

interface ConfigSuccessResponse {
  configured: boolean;
  accountSid: string | null;
  fromNumber: string | null;
}

interface ConfigErrorResponse {
  success: false;
  error: string;
}

type ConfigResponse = ConfigSuccessResponse | ConfigErrorResponse;

/**
 * Masks the middle of a string, keeping only the first N characters
 * visible. If the value is short or falsy, returns null.
 */
function maskValue(value: string | undefined, visiblePrefix: number = 4): string | null {
  if (!value) return null;
  if (value.length <= visiblePrefix + 4) return `${value.slice(0, visiblePrefix)}••••`;
  const prefix = value.slice(0, visiblePrefix);
  const suffix = value.slice(-2);
  return `${prefix}••••••${suffix}`;
}

export async function GET(request: NextRequest): Promise<NextResponse<ConfigResponse>> {
  // Auth is optional for this read-only config endpoint
  // (returns env var status, never secrets in full)
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit('sms-config:' + ip, 60, 60000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  const configured = Boolean(sid && token);

  return NextResponse.json(
    {
      configured,
      accountSid: maskValue(sid),
      fromNumber: fromNumber || null,
    },
    { status: 200, headers: corsHeaders() },
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
