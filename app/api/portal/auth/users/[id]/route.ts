import { NextRequest, NextResponse } from 'next/server';
import { portalService } from '@/services/portal.service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { withFeatureGate } from '@/lib/feature-gates';
import { validateCsrf } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders } from '@/lib/cors';
import type { SharedSupabaseClient } from '@/lib/supabase/client';

/**
 * Admin-only guard shared by DELETE + PATCH. The caller must be signed in
 * as a team admin — a plain authenticated member (viewer/agent/manager)
 * must not manage portal accounts (P1: missing admin role check).
 */
async function isAdminUser(supabase: SharedSupabaseClient, userId: string): Promise<boolean> {
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  return membership?.role === 'admin';
}

/**
 * DELETE /api/portal/auth/users/[id]
 *
 * Deletes a portal user: removes portal_shares, portal_users row,
 * and the Supabase Auth user identity.
 *
 * Requires the caller to be authenticated as an admin user.
 *
 * Returns:
 *   200 — { success: true }
 *   401 — Unauthorized
 *   403 — Forbidden (CSRF failure or non-admin caller)
 *   404 — User not found
 *   500 — Internal server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Feature gate: portal must be enabled
  const gate = withFeatureGate('portal');
  if (gate) return gate;

  // CSRF / origin check (mutation endpoint)
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  try {
    const { id } = await params;

    // Verify caller is authenticated (admin session)
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    // Admin role check (the comment claimed admin-only; the code only
    // checked getUser() — any authenticated member could delete portal users)
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403, headers: corsHeaders() });
    }

    if (!checkRateLimit(`portal-user-delete:${user.id}`, 60, 60000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400, headers: corsHeaders() });
    }

    const deleted = await portalService.deleteUser(id);

    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e) {
      const err = e as { message: string; status?: number };
      if (err.status === 404) {
        return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });
      }
    }
    console.error('[api/portal/auth/users] DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * PATCH /api/portal/auth/users/[id]
 *
 * Body: { active: boolean }
 *
 * Activates / deactivates a portal user SERVER-SIDE:
 *   1. Updates portal_users.active
 *   2. Bans / unbans the Supabase Auth user via the service-role admin
 *      client (previously this ran client-side and silently swallowed the
 *      auth-sync failure — deactivated portal users kept signing in).
 *
 * Requires the caller to be authenticated as an admin user.
 *
 * Returns:
 *   200 — { user } on success
 *   400 — Invalid body
 *   401 — Unauthorized
 *   403 — Forbidden (CSRF failure or non-admin caller)
 *   404 — User not found
 *   429 — Rate limited
 *   500 — Internal server error
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Feature gate: portal must be enabled
  const gate = withFeatureGate('portal');
  if (gate) return gate;

  // CSRF / origin check (mutation endpoint)
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400, headers: corsHeaders() });
    }

    // Verify caller is authenticated (admin session)
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    // Admin role check — only admins may ban/unban portal users
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403, headers: corsHeaders() });
    }

    if (!checkRateLimit(`portal-user-toggle:${user.id}`, 60, 60000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders() });
    }

    let body: { active?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders() });
    }

    if (typeof body.active !== 'boolean') {
      return NextResponse.json(
        { error: 'active (boolean) is required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const updated = await portalService.toggleUserActive(id, body.active);

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ user: updated }, { headers: corsHeaders() });
  } catch (e) {
    console.error('[api/portal/auth/users] PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
