/**
 * Base Supabase service with helpers for all entity services.
 * Provides configuration check, error formatting, and DB row mapping.
 */
import { activities } from '@/data/activities';
import type { ActivityType } from '@/types/activity.types';
import { generateId } from '@/lib/formatters';

export function isSupabaseConfigured(): boolean {
  return !!(
    typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Dynamically create a Supabase client. Must be called inside async functions. */
export async function getSupabaseClient() {
  const { createClient } = await import('@/lib/supabase/client');
  return createClient();
}

export function formatSupabaseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unknown database error occurred';
}

// ─── Activity Helpers (used by all services) ────────────────────────

export function addLocalActivity(
  entityType: string,
  entityId: string,
  type: string,
  description: string,
  metadata?: Record<string, unknown>,
): void {
  activities.push({
    id: `act-${generateId().slice(0, 8)}`,
    entityType,
    entityId,
    type: type as ActivityType,
    description,
    metadata,
    timestamp: new Date().toISOString(),
  });
}
