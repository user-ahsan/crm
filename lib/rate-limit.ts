import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────

interface RateEntry {
  count: number;
  resetAt: number; // epoch ms
}

// ── In-memory cache (fast path for hot starts) ──────────────────────────

const rateMap = new Map<string, RateEntry>();

// ── Supabase admin client (lazy) ────────────────────────────────────────

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      adminClient = createClient(url, key, { auth: { persistSession: false } });
    }
  }
  return adminClient;
}

// ── Bootstrap: restore active windows from Supabase on cold start ──────
// Runs once when the module is first imported.
// If Supabase is unavailable, we fall back to memory-only (still functional).

(async () => {
  const client = getAdminClient();
  if (!client) return;
  try {
    const { data } = await client
      .from('rate_limits')
      .select('key, count, reset_at')
      .gt('reset_at', new Date().toISOString());
    if (data) {
      for (const row of data) {
        rateMap.set(row.key, {
          count: row.count,
          resetAt: new Date(row.reset_at).getTime(),
        });
      }
    }
  } catch {
    // Supabase unavailable — in-memory only, rate limits start fresh per cold start
  }
})();

// ── Persist helper (fire-and-forget) ────────────────────────────────────

function persist(key: string, count: number, resetAt: number): void {
  try {
    const client = getAdminClient();
    if (!client) return;
    Promise.resolve(
      client
        .from('rate_limits')
        .upsert(
          { key, count, reset_at: new Date(resetAt).toISOString() },
          { onConflict: 'key' }
        )
    ).then(() => {}).catch(() => {});
  } catch {
    // Memory-only fallback is acceptable
  }
}

// ── Public API (unchanged signature) ────────────────────────────────────

/**
 * Check whether the caller identified by `key` is allowed to proceed.
 *
 * Returns `true` if the request is within the rate limit,
 * `false` if the limit has been exceeded.
 *
 * @param key         Unique identifier for the caller (user ID, IP, etc.)
 * @param maxRequests  Maximum number of requests allowed in the window
 * @param windowMs     Window duration in milliseconds
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);

  // First request or expired window → start a new window
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    persist(key, 1, now + windowMs);
    return true;
  }

  // Window still active but limit reached
  if (entry.count >= maxRequests) return false;

  // Within limit → increment
  entry.count++;
  persist(key, entry.count, entry.resetAt);
  return true;
}
