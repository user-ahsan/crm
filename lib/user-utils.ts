import { USERS } from '@/data/mock-users';
import type { MockUser } from '@/data/mock-users';

/**
 * User resolution utilities (mock source).
 *
 * Use these when rendering a stored user id (assignedTo / createdBy / userId):
 *   getUser(id)      → the MockUser record or undefined (null-safe)
 *   getUserName(id)  → display name or the given fallback ('—' by default)
 *
 * They return undefined/'—' for unknown or empty ids so UI never renders a raw id
 * or crashes on a dangling reference. See .tmp/audit/fixes/PATTERN-users.md.
 */

export function getUser(id: string | null | undefined): MockUser | undefined {
  if (!id) return undefined;
  return USERS.find((u) => u.id === id);
}

export function getUserName(id: string | null | undefined, fallback = '—'): string {
  return getUser(id)?.name ?? fallback;
}
