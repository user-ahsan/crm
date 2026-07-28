import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens, storeTokens } from '@/lib/google-calendar';
import { withFeatureGate } from '@/lib/feature-gates';

/**
 * GET /api/integrations/google/callback
 *
 * Handles the OAuth2 callback from Google.
 * Exchanges the authorization code for tokens, stores them securely,
 * and redirects back to the integrations settings page.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Feature gate: calendar_sync must be enabled
  const gate = withFeatureGate('calendar_sync');
  if (gate) return gate;

  const redirectBase = new URL('/settings/integrations', request.url);
  const errorRedirect = (message: string) => {
    redirectBase.searchParams.set('oauth_error', message);
    return NextResponse.redirect(redirectBase);
  };

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    // User denied OAuth consent
    if (error === 'access_denied') {
      return errorRedirect('access_denied');
    }

    if (!code) {
      return errorRedirect('missing_auth_code');
    }

    // Verify the authenticated user matches the state
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorRedirect('unauthenticated');
    }

    // If state was provided, verify it matches the current user
    if (state && state !== user.id) {
      return errorRedirect('state_mismatch');
    }

    // Exchange the authorization code for tokens
    const { tokens, email } = await exchangeCodeForTokens(code);

    // Store the tokens in the database
    await storeTokens(user.id, {
      ...tokens,
      email: email || 'google-user@unknown.com',
    });

    // Successful connection — redirect with success flag
    redirectBase.searchParams.set('oauth_success', 'true');
    redirectBase.searchParams.set('oauth_provider', 'google');
    if (email) {
      redirectBase.searchParams.set('oauth_email', email);
    }

    return NextResponse.redirect(redirectBase);
  } catch (e) {
    console.error('[google-callback] OAuth callback error:', e);
    const message =
      e instanceof Error ? e.message : 'unknown_callback_error';
    return errorRedirect(message);
  }
}
