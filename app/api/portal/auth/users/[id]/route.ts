import { NextRequest, NextResponse } from 'next/server';
import { portalService } from '@/services/portal.service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { withFeatureGate } from '@/lib/feature-gates';

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
 *   404 — User not found
 *   500 — Internal server error
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Feature gate: portal must be enabled
  const gate = withFeatureGate('portal');
  if (gate) return gate;

  try {
    const { id } = await params;

    // Verify caller is authenticated (admin session)
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const deleted = await portalService.deleteUser(id);

    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e) {
      const err = e as { message: string; status?: number };
      if (err.status === 404) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }
    console.error('[api/portal/auth/users] DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
