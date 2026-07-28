import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { withFeatureGate } from '@/lib/feature-gates';

/**
 * POST /api/portal/auth/login
 *
 * Authenticates a portal user via Supabase Auth using email + password.
 * Supabase handles session creation (access_token / refresh_token) and
 * sets the appropriate auth cookies via the server client.
 *
 * Rate limiting is handled by Supabase Auth's built-in rate limits.
 *
 * Body (JSON):
 *   - email: string  — Portal user email
 *   - password: string — Portal user password
 *
 * Returns:
 *   200 — { session, user } on success
 *   400 — Missing or invalid fields
 *   401 — Invalid credentials
 *   429 — Rate limited
 *   500 — Internal server error
 */
export async function POST(request: NextRequest) {
  // Feature gate: portal must be enabled
  const gate = withFeatureGate('portal');
  if (gate) return gate;

  try {
    let body: { email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Too many login attempts. Please try again later.' },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: error.message || 'Invalid email or password' },
        { status: 401 },
      );
    }

    if (!data.session || !data.user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    // Update last_login in portal_users
    await supabase
      .from('portal_users')
      .update({ last_login: new Date().toISOString() } as never)
      .eq('id', data.user.id);

    return NextResponse.json({
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      },
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name ?? data.user.email?.split('@')[0] ?? 'Portal User',
      },
    });
  } catch (e) {
    console.error('[api/portal/auth/login] POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
