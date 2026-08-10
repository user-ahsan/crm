/**
 * Base Supabase service with helpers for all entity services.
 * Provides configuration check, error formatting, and type-safe enum validation.
 */

import { isSupabaseConfigured as isSupabaseConfiguredImpl } from '@/lib/supabase/client';

/**
 * Returns whether real Supabase credentials are configured.
 * `false` means the app runs in mock mode — getSharedClient() returns the
 * mock client backed by data/*.ts (see .tmp/audit/fixes/PATTERN-mock-mode.md).
 * Single source of truth: lib/supabase/client.ts.
 */
export function isSupabaseConfigured(): boolean {
  return isSupabaseConfiguredImpl();
}

/**
 * Type-safe enum cast with validation.
 * Throws if the value is not in the valid set.
 */
export function asEnum<T extends string>(value: string, validValues: readonly T[]): T {
  if (validValues.includes(value as T)) return value as T;
  throw new Error(`Invalid enum value: ${value}`);
}

/**
 * Typed service error preserving Supabase error code and HTTP status.
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Converts any thrown value into a ServiceError, preserving code/status
 * from Supabase-style error objects and keeping existing ServiceErrors intact.
 */
export function toServiceError(e: unknown): ServiceError {
  if (e instanceof ServiceError) return e;
  if (e && typeof e === 'object' && 'code' in e) {
    const obj = e as Record<string, unknown>;
    return new ServiceError(
      (obj.message as string) ?? 'Unknown error',
      (obj.code as string) ?? undefined,
      (obj.status as number) ?? (obj.statusCode as number) ?? undefined,
    );
  }
  return new ServiceError(
    e instanceof Error ? e.message : 'Unknown error',
  );
}

/** @deprecated Use toServiceError() instead — preserves error codes. */
export function formatSupabaseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return 'An unknown database error occurred';
}

