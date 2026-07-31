import { Resend } from 'resend';
import { isFeatureEnabled } from './feature-gates';
import { getServiceConfig } from './service-config';

let _resend: Resend | null = null;

/** Gated: true when Resend feature gate AND a configured API key exist. Env-var fast check. */
export function isResendConfigured(): boolean {
  return isFeatureEnabled('email') && !!process.env.RESEND_API_KEY;
}

/**
 * Async config-aware check. Reads from Supabase service_configs first
 * (saved via the Settings > Services UI), falls back to env vars.
 * This is the single source of truth for whether email actually works.
 */
export async function isResendReady(): Promise<boolean> {
  if (!isFeatureEnabled('email')) return false;
  const config = await getServiceConfig('email');
  return !!(config.api_key && config.from_email);
}

/** Resend client singleton. Throws only when called but not configured. */
export function getResendClient(): Resend {
  if (!isResendConfigured()) {
    throw new Error('Cannot initialize Resend client: RESEND_API_KEY is not configured');
  }
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return _resend;
}

/**
 * Builds a Resend client from a resolved config (Supabase-first).
 * Used by services that already loaded config via getServiceConfig('email').
 */
export function createResendClientFromConfig(config: Record<string, string | null>): Resend {
  const apiKey = config.api_key || process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Cannot initialize Resend client: no API key configured');
  }
  return new Resend(apiKey);
}
