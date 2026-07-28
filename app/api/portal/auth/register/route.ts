import { NextRequest, NextResponse } from 'next/server';
import { portalService } from '@/services/portal.service';
import { withFeatureGate } from '@/lib/feature-gates';

/**
 * POST /api/portal/auth/register
 *
 * Creates a new portal user with a Supabase Auth identity.
 * Requires SUPABASE_SERVICE_ROLE_KEY environment variable.
 *
 * Flow:
 *   1. Validates password strength
 *   2. Creates auth.users entry via supabase.auth.admin.createUser()
 *   3. Inserts portal_users profile row with matching ID
 *
 * Body (JSON):
 *   - email: string     — Portal user email
 *   - name: string      — Portal user display name
 *   - password: string   — Strong password (validated server-side)
 *
 * Returns:
 *   201 — { user } on success
 *   400 — Validation error
 *   409 — Email already exists (auth or portal)
 *   500 — Internal server error
 */
export async function POST(request: NextRequest) {
  // Feature gate: portal must be enabled
  const gate = withFeatureGate('portal');
  if (gate) return gate;

  try {
    let body: { email?: string; name?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    const password = body.password;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const user = await portalService.createUser({ email, name, password });

    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e) {
      const err = e as { code?: string; message: string; status?: number };
      if (err.message?.includes('already been registered') || err.message?.includes('email already')) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
      }
      if (err.code === 'VALIDATION_ERROR') {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }
    if (e instanceof Error && e.message?.includes('Missing')) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    console.error('[api/portal/auth/register] POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
