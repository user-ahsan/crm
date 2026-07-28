/**
 * ─── Service Configuration Utility ──────────────────────────────────────
 *
 * Reads service config from Supabase first (user-configured via UI),
 * falls back to environment variables for backward compatibility.
 *
 * All 10 external services are supported:
 *   email | sms | webhooks | email_sequences | workflow_editor
 *   calendar_sync | portal | realtime | invoices | standalone_invoice
 *
 * Usage:
 *   const config = await getServiceConfig('email');
 *   // { api_key: 're_xxx', from_email: '...', from_name: '...' }
 *   // Falls back to process.env.RESEND_API_KEY etc. if no DB row.
 * ────────────────────────────────────────────────────────────────────────
 */

import { createClient } from './supabase/client';

export type ServiceName =
  | 'email'
  | 'sms'
  | 'webhooks'
  | 'email_sequences'
  | 'workflow_editor'
  | 'calendar_sync'
  | 'portal'
  | 'realtime'
  | 'invoices'
  | 'standalone_invoice';

export type ServiceTestResult = {
  success: boolean;
  message: string;
  details?: string;
};

/** Default env-var mappings for each service. */
const ENV_FALLBACKS: Record<ServiceName, Record<string, string>> = {
  email: {
    api_key: 'RESEND_API_KEY',
    from_email: 'RESEND_FROM_EMAIL',
    from_name: 'RESEND_FROM_NAME',
  },
  sms: {
    account_sid: 'TWILIO_ACCOUNT_SID',
    auth_token: 'TWILIO_AUTH_TOKEN',
    from_number: 'TWILIO_FROM_NUMBER',
  },
  webhooks: {
    webhook_url: 'N8N_WEBHOOK_URL',
    webhook_secret: 'N8N_WEBHOOK_SECRET',
  },
  email_sequences: { enabled: 'NEXT_PUBLIC_ENABLE_EMAIL_SEQUENCES' },
  workflow_editor: { enabled: 'NEXT_PUBLIC_ENABLE_WORKFLOW_EDITOR' },
  calendar_sync: { enabled: 'NEXT_PUBLIC_ENABLE_CALENDAR_SYNC' },
  portal: { enabled: 'NEXT_PUBLIC_ENABLE_PORTAL' },
  realtime: { enabled: 'NEXT_PUBLIC_ENABLE_REALTIME' },
  invoices: { enabled: 'NEXT_PUBLIC_ENABLE_INVOICES' },
  standalone_invoice: { enabled: 'NEXT_PUBLIC_ENABLE_STANDALONE_INVOICE' },
};

/** Default fallback values for each service. */
const DEFAULT_VALUES: Record<string, string> = {
  from_number: '+15551234567',
  from_name: 'NexusCRM',
};

/**
 * Returns the merged config for a service.
 * Supabase values override env-var defaults.
 */
export async function getServiceConfig(service: ServiceName): Promise<Record<string, string | null>> {
  const fallbacks = ENV_FALLBACKS[service];
  const envConfig: Record<string, string | null> = {};

  // Read from env vars first
  for (const [key, envVar] of Object.entries(fallbacks)) {
    envConfig[key] = process.env[envVar] ?? DEFAULT_VALUES[key] ?? null;
  }

  // Try to read from Supabase (overrides env vars)
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('service_configs')
      .select('config')
      .eq('service', service)
      .maybeSingle();

    if (!error && data?.config) {
      const dbConfig = data.config as Record<string, string>;
      for (const key of Object.keys(fallbacks)) {
        if (dbConfig[key] !== undefined && dbConfig[key] !== null && dbConfig[key] !== '') {
          envConfig[key] = dbConfig[key];
        }
      }
    }
  } catch {
    // Silent fallback — env vars are sufficient
  }

  return envConfig;
}

/**
 * Saves service config to Supabase.
 * Merges with existing config (partial update).
 */
export async function saveServiceConfig(
  service: ServiceName,
  config: Record<string, string>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Fetch existing to merge
    const { data: existing } = await supabase
      .from('service_configs')
      .select('config')
      .eq('service', service)
      .maybeSingle();

    const mergedConfig = { ...((existing?.config as Record<string, string>) ?? {}), ...config };

    const { error } = await supabase.from('service_configs').upsert(
      {
        service,
        config: mergedConfig,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'service' },
    );

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Checks if a service has enough configuration to work.
 * For feature-toggles: checks if enabled === 'true'.
 * For API-key services: checks if the required keys are present.
 */
export async function isServiceUsable(service: ServiceName): Promise<boolean> {
  const config = await getServiceConfig(service);

  switch (service) {
    case 'email':
      return !!config.api_key && !!config.from_email;
    case 'sms':
      return !!config.account_sid && !!config.auth_token;
    case 'webhooks':
      return !!config.webhook_url;
    case 'email_sequences':
    case 'workflow_editor':
    case 'calendar_sync':
    case 'portal':
    case 'realtime':
    case 'invoices':
    case 'standalone_invoice':
      return config.enabled === 'true';
    default:
      return false;
  }
}
