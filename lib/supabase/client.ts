/**
 * Creates a Supabase client via dynamic import.
 * Using dynamic import so this file doesn't break when @supabase/ssr is not installed.
 */
export async function createClient() {
  const { createBrowserClient } = await import('@supabase/ssr');
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
