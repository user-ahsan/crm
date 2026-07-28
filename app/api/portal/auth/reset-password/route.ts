import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { withFeatureGate } from '@/lib/feature-gates';

/**
 * POST /api/portal/auth/reset-password
 *
 * Sends a password reset email to the portal user via Supabase Auth's
 * built-in resetPasswordForEmail flow.
 *
 * Supabase Auth handles rate limiting for password reset requests.
 *
 * Body (JSON):
 *   - email: string — Portal user email
 *
 * Returns:
 *   200 — { success: true, message: 'Password reset email sent' }
 *   400 — Missing email
 *   429 — Rate limited
 *   500 — Internal server error
 */
export async function POST(request: NextRequest) {
  // Feature gate: portal must be enabled
  const gate = withFeatureGate('portal');
  if (gate) return gate;

  try {
    let body: { email?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3000'}/portal/auth/callback`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: error.message || 'Failed to send reset email' },
        { status: 400 },
      );
    }

    // Always return success to avoid email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (e) {
    console.error('[api/portal/auth/reset-password] POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
