/**
 * ─── API Key Authentication Helper ────────────────────────────────────────
 *
 * Consumer middleware for API keys minted by apiKeyService.create().
 * Any future external API route (e.g. `/api/v1/*`) should call
 * `authenticateApiKey(request)` as its first gate:
 *
 *   import { authenticateApiKey } from '@/lib/api-key-auth';
 *
 *   export async function GET(request: NextRequest) {
 *     const auth = await authenticateApiKey(request);
 *     if (!auth.ok) {
 *       return NextResponse.json(
 *         { error: auth.error },
 *         { status: 401, headers: corsHeaders() },
 *       );
 *     }
 *     // auth.key — the validated, non-expired ApiKey (scopes available)
 *   }
 *
 * Accepted credential sources (in order):
 *   1. `Authorization: Bearer sk_...`
 *   2. `x-api-key: sk_...`
 *
 * Validation delegates to apiKeyService.validateApiKey(), which hashes the
 * presented key, rejects expired/revoked (deleted) keys, and records
 * `last_used_at`.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { apiKeyService } from '@/services/api-key.service';
import type { ApiKey } from '@/types/api-key.types';

export type ApiKeyAuthResult =
  | { ok: true; key: ApiKey }
  | { ok: false; error: string };

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

/**
 * Authenticates an incoming request against the api_keys table.
 *
 * @param req — the incoming Next.js or standard Request
 * @returns   — `{ ok: true, key }` on success, `{ ok: false, error }` otherwise
 */
export async function authenticateApiKey(req: Request): Promise<ApiKeyAuthResult> {
  const authHeader = req.headers.get('authorization');
  const bearerMatch = authHeader ? BEARER_PATTERN.exec(authHeader) : null;
  const presented = bearerMatch
    ? bearerMatch[1].trim()
    : (req.headers.get('x-api-key')?.trim() ?? '');

  if (!presented) {
    return {
      ok: false,
      error: 'Missing API key. Provide it via "Authorization: Bearer sk_..." or the x-api-key header.',
    };
  }

  try {
    const key = await apiKeyService.validateApiKey(presented);
    if (!key) {
      return { ok: false, error: 'Invalid, expired, or revoked API key.' };
    }
    return { ok: true, key };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'API key validation failed.',
    };
  }
}
