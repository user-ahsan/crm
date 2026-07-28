import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { validateCsrf } from '@/lib/csrf';

/**
 * GET /api/settings/email
 *
 * Retrieves the current user's email configuration from the server.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch email config from user_settings or notification_preferences
    const { error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Also try from a dedicated email_config table — for now, use env vars or user metadata as authoritative
    const emailConfig = user.user_metadata?.email_config as { fromEmail?: string; fromName?: string } | undefined;
    const fromEmail = emailConfig?.fromEmail || process.env.RESEND_FROM_EMAIL || '';
    const fromName = emailConfig?.fromName || process.env.RESEND_FROM_NAME || '';
    return NextResponse.json({
      apiKey: process.env.RESEND_API_KEY ? '••••••••' : '',
      fromEmail,
      fromName,
      configured: !!(process.env.RESEND_API_KEY && fromEmail),
    });
  } catch (e) {
    console.error('[api/settings/email] GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/settings/email
 *
 * Updates email sender configuration (fromEmail, fromName only).
 *
 * 🔒 SECURITY: The Resend API key must NEVER be received from the client.
 *   - API keys are read from server environment variables (RESEND_API_KEY)
 *   - To change the API key, update the RESEND_API_KEY environment variable on your server
 *   - No API route should ever accept the API key from the client side
 *
 * Body (JSON):
 *   - fromEmail?: string  — Verified sender email address
 *   - fromName?: string   — Display name for outgoing emails
 */
export async function POST(request: NextRequest) {
  // ── CSRF / Origin check ───────────────────────────────────────
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ⚠️ SECURITY: Only accept fromEmail and fromName — NEVER accept apiKey from the client.
    // The Resend API key must be configured via server environment variable RESEND_API_KEY only.
    let body: { fromEmail?: string; fromName?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!body.fromEmail?.trim()) {
      return NextResponse.json({ error: 'fromEmail is required' }, { status: 400 });
    }
    if (!body.fromEmail.includes('@')) {
      return NextResponse.json({ error: 'Invalid fromEmail' }, { status: 400 });
    }

    // ── Save to user metadata ──────────────────────────────────────
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        email_config: {
          fromEmail: body.fromEmail.trim(),
          fromName: body.fromName?.trim() ?? '',
        },
      },
    });

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save email configuration' }, { status: 500 });
    }

    // 🔒 SECURITY: Email API keys must be configured via server environment variables,
    // never stored in the database or transmitted client-side.
    // To update: set RESEND_API_KEY in your server's environment and restart the process.
    return NextResponse.json({
      success: true,
      fromEmail: body.fromEmail.trim(),
      fromName: body.fromName?.trim() ?? '',
      message: 'Email configuration saved successfully.',
    });
  } catch (e) {
    console.error('[api/settings/email] POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
