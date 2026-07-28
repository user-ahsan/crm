import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revokeGoogleTokens } from '@/lib/google-calendar';
import { integrationService } from '@/services/integration.service';
import { corsHeaders } from '@/lib/cors';
import { withFeatureGate } from '@/lib/feature-gates';

/**
 * POST /api/integrations/google/disconnect
 *
 * Revokes Google OAuth tokens and removes the integration record.
 * Body: { integrationId: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Feature gate: calendar_sync must be enabled
  const gate = withFeatureGate('calendar_sync');
  if (gate) return gate;

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders() },
      );
    }

    // Parse the request body for integrationId
    let body: { integrationId?: string };
    try {
      body = (await request.json()) as { integrationId?: string };
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const { integrationId } = body;
    if (!integrationId) {
      return NextResponse.json(
        { error: 'integrationId is required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    // Revoke tokens with Google (non-fatal if this fails — we still disconnect)
    try {
      await revokeGoogleTokens(user.id);
    } catch (revokeError) {
      console.error('[google-disconnect] Token revocation failed:', revokeError);
      // Continue with local cleanup
    }

    // Remove the integration record
    await integrationService.disconnect(integrationId);

    return NextResponse.json(
      { success: true, message: 'Google Calendar disconnected' },
      { status: 200, headers: corsHeaders() },
    );
  } catch (e) {
    console.error('[google-disconnect] Error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to disconnect' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
