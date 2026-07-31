import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { validateCsrf } from '@/lib/csrf';
import { corsHeaders } from '@/lib/cors';
import { getServiceConfig, saveServiceConfig } from '@/lib/service-config';

/**
 * GET /api/settings/email
 *
 * Legacy endpoint — retrieves the email configuration.
 * Now delegates to the centralized service_configs table
 * (same source the Settings > Services page uses). No duplicate storage.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const config = await getServiceConfig('email');
    const fromEmail = config.from_email || process.env.RESEND_FROM_EMAIL || '';
    const fromName = config.from_name || process.env.RESEND_FROM_NAME || 'NexusCRM';

    return NextResponse.json({
      apiKey: config.api_key ? '••••••••' : '',
      fromEmail,
      fromName,
      configured: !!(config.api_key && fromEmail),
    }, { headers: corsHeaders() });
  } catch (e) {
    console.error('[api/settings/email] GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * POST /api/settings/email
 *
 * Legacy endpoint — saves email sender configuration.
 * Now delegates to the centralized service_configs table.
 * Accepts fromEmail and fromName (NOT the API key, which must come from
 * the admin-configured Settings > Services page or env vars).
 */
export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    let body: { fromEmail?: string; fromName?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders() });
    }

    const update: Record<string, string> = {};
    if (body.fromEmail?.trim()) {
      if (!body.fromEmail.includes('@')) {
        return NextResponse.json({ error: 'Invalid fromEmail' }, { status: 400, headers: corsHeaders() });
      }
      update.from_email = body.fromEmail.trim();
    }
    if (body.fromName?.trim()) {
      update.from_name = body.fromName.trim();
    }

    const result = await saveServiceConfig('email', update);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Failed to save email configuration' }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({
      success: true,
      fromEmail: body.fromEmail?.trim(),
      fromName: body.fromName?.trim() ?? '',
      message: 'Email configuration saved successfully.',
    }, { headers: corsHeaders() });
  } catch (e) {
    console.error('[api/settings/email] POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
