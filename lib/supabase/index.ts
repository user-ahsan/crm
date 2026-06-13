/**
 * Supabase client library.
 *
 * Provides browser, server, and middleware clients
 * all typed against the project's Database schema.
 */
export { createClient } from './client';
export { createServerSupabaseClient } from './server';
export { updateSession } from './middleware';
