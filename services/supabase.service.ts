/**
 * Base Supabase service with helpers for all entity services.
 * Provides configuration check, error formatting, and activity helpers.
 */
import type { ActivityType } from '@/types/activity.types';

/** In-memory activity buffer for non-critical local logging alongside Supabase operations. */
const localActivities: Array<{
  id: string;
  entityType: string;
  entityId: string;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}> = [];

export function isSupabaseConfigured(): boolean {
  return !!(
    typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
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
  localActivities.push({
    id: crypto.randomUUID(),
    entityType,
    entityId,
    type: type as ActivityType,
    description,
    metadata,
    timestamp: new Date().toISOString(),
  });
}
