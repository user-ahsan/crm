/**
 * Creates a Supabase client via dynamic import.
 * Using dynamic import so this file doesn't break when @supabase/ssr is not installed.
 * Throws a descriptive error if environment variables are missing.
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
