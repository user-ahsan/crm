/**
 * Base Supabase service with helpers for all entity services.
 * Provides configuration check, pagination, error formatting, and DB row mapping.
 */
import { activities } from '@/data/activities';
import type { ActivityType } from '@/types/activity.types';
import { generateId } from '@/lib/formatters';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

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

export function buildPagination(
  page: number = 1,
  pageSize: number = 50,
): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

export function paginateResult<T>(
  data: T[],
  page: number = 1,
  pageSize: number = 50,
  totalCount?: number,
): PaginatedResult<T> {
  const count = totalCount ?? data.length;
  return {
    data,
    count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  };
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
