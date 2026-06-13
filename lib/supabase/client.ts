/**
 * Creates a Supabase browser client for use in client components.
 * Uses static import from @supabase/ssr for cookie-based session management.
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables. ' +
      'Ensure they are set in your .env file (see .env.example for the required format).'
    );
  }

  const { createBrowserClient } = await import('@supabase/ssr');
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
