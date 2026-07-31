import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders } from '@/lib/cors';
import { validateCsrf } from '@/lib/csrf';
import { getServiceConfig, saveServiceConfig } from '@/lib/service-config';

/**
 * ─── SMS Config Route (Legacy) ─────────────────────────────────────────
 *
 * GET /api/sms/config — returns whether Twilio is configured (masked).
 * PUT /api/sms/config — saves Twilio credentials.
 *
 * Both delegate to the centralized service_configs table — the same
 * source the Settings > Services page uses. No duplicate storage.
 * ───────────────────────────────────────────────────────────────────────
 */

function maskValue(value: string | undefined, visiblePrefix: number = 4): string | null {
  if (!value) return null;
  if (value.length <= visiblePrefix + 4) return `${value.slice(0, visiblePrefix)}••••`;
  const prefix = value.slice(0, visiblePrefix);
  const suffix = value.slice(-2);
  return `${prefix}••••••${suffix}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit('sms-config:' + ip, 60, 60000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
  }

  const config = await getServiceConfig('sms');
  const sid = config.account_sid || undefined;
  const token = config.auth_token || undefined;
  const fromNumber = config.from_number || undefined;

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

export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!validateCsrf(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  try {
    const body = await request.json();
    const update: Record<string, string> = {};

    if (body.accountSid?.trim()) {
      if (!body.accountSid.startsWith('AC')) {
        return NextResponse.json({ success: false, error: 'Account SID must start with "AC"' }, { status: 400, headers: corsHeaders() });
      }
      if (body.accountSid.includes('••••')) return NextResponse.json({ success: false, error: 'Invalid Account SID' }, { status: 400, headers: corsHeaders() });
      update.account_sid = body.accountSid.trim();
    }
    if (body.authToken?.trim()) {
      if (body.authToken.includes('••••')) return NextResponse.json({ success: false, error: 'Invalid Auth Token' }, { status: 400, headers: corsHeaders() });
      update.auth_token = body.authToken.trim();
    }
    if (body.fromNumber?.trim()) {
      update.from_number = body.fromNumber.trim();
    }

    const result = await saveServiceConfig('sms', update);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error ?? 'Failed to save' }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
