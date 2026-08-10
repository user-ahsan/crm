import { NextRequest, NextResponse } from 'next/server';
import { portalService } from '@/services/portal.service';
import { withFeatureGate } from '@/lib/feature-gates';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { validateCsrf } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders } from '@/lib/cors';

/**
 * POST /api/portal/auth/register
 *
 * Creates a new portal user with a Supabase Auth identity.
 *
 * SECURITY (C3 fix): this endpoint mints CONFIRMED Supabase Auth users via
 * the service-role key, so it is ADMIN-ONLY — the caller must be signed in
 * as a team admin. It is also CSRF-checked and rate-limited. Portal user
 * creation happens from the admin settings UI only; anonymous registration
 * is rejected.
 *
 * Flow:
 *   1. Feature gate: portal must be enabled
 *   2. CSRF / origin check
 *   3. Authenticated admin session (getUser + team_members role === admin)
 *   4. Rate limit (10 user-creations / minute / admin)
 *   5. Validates password strength
 *   6. Creates auth.users entry via supabase.auth.admin.createUser()
 *   7. Inserts portal_users profile row with matching ID
 *
 * Body (JSON):
 *   - email: string     — Portal user email
 *   - name: string      — Portal user display name
 *   - password: string   — Strong password (validated server-side)
 *
 * Returns:
 *   201 — { user } on success
 *   400 — Validation error
 *   401 — Unauthenticated
 *   403 — Forbidden (CSRF failure or non-admin caller)
 *   409 — Email already exists (auth or portal)
 *   429 — Rate limited
 *   500 — Internal server error
 */
export async function POST(request: NextRequest) {
  // Feature gate: portal must be enabled
  const gate = withFeatureGate('portal');
  if (gate) return gate;

  // CSRF / origin check
  if (!validateCsrf(request)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403, headers: corsHeaders() },
    );
  }

  try {
    // Require an authenticated admin session (C3 — this route previously
    // minted confirmed auth users with no session check at all).
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders() },
      );
    }

    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: admin role required' },
        { status: 403, headers: corsHeaders() },
      );
    }

    if (!checkRateLimit(`portal-register:${user.id}`, 10, 60000)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: corsHeaders() },
      );
    }

    let body: { email?: string; name?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders() });
    }

    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    const password = body.password;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400, headers: corsHeaders() });
    }
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: corsHeaders() });
    }
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400, headers: corsHeaders() });
    }

    const userCreated = await portalService.createUser({ email, name, password });

    return NextResponse.json({ user: userCreated }, { status: 201, headers: corsHeaders() });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e) {
      const err = e as { code?: string; message: string; status?: number };
      if (err.message?.includes('already been registered') || err.message?.includes('email already')) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409, headers: corsHeaders() });
      }
      if (err.code === 'VALIDATION_ERROR') {
        return NextResponse.json({ error: err.message }, { status: 400, headers: corsHeaders() });
      }
    }
    if (e instanceof Error && (e.message?.includes('Missing') || e.message?.includes('admin configuration is incomplete'))) {
      return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders() });
    }
    console.error('[api/portal/auth/register] POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
