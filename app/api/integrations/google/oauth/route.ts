import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getGoogleAuthUrl } from '@/lib/google-calendar';
import { withFeatureGate } from '@/lib/feature-gates';

/**
 * GET /api/integrations/google/oauth
 *
 * Initiates the Google OAuth2 flow by redirecting the user to the
 * Google consent screen. The authenticated user ID is passed as
 * state to prevent CSRF on the callback.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Feature gate: calendar_sync must be enabled
  const gate = withFeatureGate('calendar_sync');
  if (gate) return gate;

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const redirectUrl = new URL('/login', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Pass the user ID as state to be verified in the callback
    const authUrl = await getGoogleAuthUrl(user.id);

    return NextResponse.redirect(authUrl);
  } catch (e) {
    console.error('[google-oauth] Error generating auth URL:', e);
    const errorUrl = new URL('/settings/integrations', request.url);
    errorUrl.searchParams.set('oauth_error', 'failed_to_generate_auth_url');
    return NextResponse.redirect(errorUrl);
  }
}
