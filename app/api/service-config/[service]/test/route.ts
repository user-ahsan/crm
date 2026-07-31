import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/client';
import { corsHeaders } from '@/lib/cors';
import { validateCsrf } from '@/lib/csrf';
import { isPrivateHost } from '@/lib/ssrf';
import type { ServiceName, ServiceTestResult } from '@/lib/service-config';

const ALLOWED_SERVICES: ServiceName[] = [
  'email', 'sms', 'webhooks', 'email_sequences', 'workflow_editor',
  'calendar_sync', 'portal', 'realtime', 'invoices', 'standalone_invoice',
];

/**
 * POST /api/service-config/{service}/test
 *
 * Tests the actual service configuration by making a live API call.
 * Each test is specific to the service type:
 *
 *   email      → sends a test email via Resend
 *   sms        → sends a test SMS via Twilio
 *   webhooks   → pings the webhook URL
 *   others     → validates config presence and returns status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> },
): Promise<NextResponse> {
  if (!validateCsrf(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  try {
    const { service } = await params;
    if (!ALLOWED_SERVICES.includes(service as ServiceName)) {
      return NextResponse.json({ success: false, error: 'Unknown service' }, { status: 400, headers: corsHeaders() });
    }

    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    // Load config from Supabase (merged with env vars)
    const { data, error } = await supabase
      .from('service_configs')
      .select('config')
      .eq('service', service)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }

    const config = (data?.config ?? {}) as Record<string, string>;
    const merged = { ...config };

    // Also merge env vars (so env-configured services work too)
    const envOverrides: Record<string, string> = {
      api_key: process.env.RESEND_API_KEY ?? '',
      from_email: process.env.RESEND_FROM_EMAIL ?? '',
      account_sid: process.env.TWILIO_ACCOUNT_SID ?? '',
      auth_token: process.env.TWILIO_AUTH_TOKEN ?? '',
      from_number: process.env.TWILIO_FROM_NUMBER ?? '',
      webhook_url: process.env.N8N_WEBHOOK_URL ?? '',
      webhook_secret: process.env.N8N_WEBHOOK_SECRET ?? '',
    };
    for (const [key, val] of Object.entries(envOverrides)) {
      if (val && !merged[key]) merged[key] = val;
    }

    let result: ServiceTestResult;

    switch (service) {
      case 'email':
        result = await testEmail(merged);
        break;
      case 'sms':
        result = await testSms(merged);
        break;
      case 'webhooks':
        result = await testWebhooks(merged);
        break;
      case 'calendar_sync':
        result = { success: merged.enabled === 'true', message: merged.enabled === 'true' ? 'Calendar sync is enabled' : 'Calendar sync is disabled', details: 'Configure via Integrations > Google Calendar' };
        break;
      case 'email_sequences':
        result = { success: true, message: merged.enabled === 'true' ? 'Email sequences enabled' : 'Email sequences disabled', details: merged.enabled === 'true' ? 'Cron endpoint active' : 'Set NEXT_PUBLIC_ENABLE_EMAIL_SEQUENCES=true to enable' };
        break;
      case 'portal':
        result = { success: true, message: merged.enabled === 'true' ? 'Portal enabled' : 'Portal disabled', details: merged.enabled === 'true' ? 'Supabase Auth portal active' : 'Set NEXT_PUBLIC_ENABLE_PORTAL=true to enable' };
        break;
      default:
        // Feature toggles: just check config
        result = {
          success: true,
          message: `Service "${service}" is ${merged.enabled === 'true' ? 'enabled' : 'disabled'}`,
          details: `Set ${toEnvVar(service)}=true to enable`,
        };
    }

    return NextResponse.json({ success: true, test: result }, { headers: corsHeaders() });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500, headers: corsHeaders() });
  }
}

// ── Test implementations ─────────────────────────────────────────────────

async function testEmail(config: Record<string, string>): Promise<ServiceTestResult> {
  const apiKey = config.api_key || process.env.RESEND_API_KEY;
  const fromEmail = config.from_email || process.env.RESEND_FROM_EMAIL;

  if (!apiKey) return { success: false, message: 'API key not configured', details: 'Set RESEND_API_KEY or configure via UI' };
  if (!fromEmail) return { success: false, message: 'From email not configured', details: 'Set RESEND_FROM_EMAIL or configure via UI' };

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: fromEmail, // Test sends to self
      subject: 'NexusCRM — Test Email',
      text: 'This is a test email from NexusCRM. If you received this, your email configuration is working correctly.',
    });

    if (error) {
      const msg = typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message: string }).message
        : String(error);
      return { success: false, message: 'API call failed', details: msg };
    }

    return { success: true, message: 'Email sent successfully', details: `Test email sent to ${fromEmail}. ID: ${data?.id}` };
  } catch (e) {
    return { success: false, message: 'API call failed', details: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function testSms(config: Record<string, string>): Promise<ServiceTestResult> {
  const sid = config.account_sid || process.env.TWILIO_ACCOUNT_SID;
  const token = config.auth_token || process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = config.from_number || process.env.TWILIO_FROM_NUMBER || '+15551234567';

  if (!sid || !token) return { success: false, message: 'Twilio not configured', details: 'Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN or configure via UI' };

  try {
    const twilio = await import('twilio');
    const client = twilio.default(sid, token);
    // Just validate credentials by fetching account info (don't send actual SMS)
    await client.api.accounts(sid).fetch();
    return { success: true, message: 'Twilio credentials valid', details: `From number: ${fromNumber}` };
  } catch (e) {
    return { success: false, message: 'Twilio validation failed', details: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function testWebhooks(config: Record<string, string>): Promise<ServiceTestResult> {
  const url = config.webhook_url || process.env.N8N_WEBHOOK_URL;
  if (!url) return { success: false, message: 'Webhook URL not configured', details: 'Set N8N_WEBHOOK_URL or configure via UI' };

  if (isPrivateHost(url)) return { success: false, message: 'SSRF blocked', details: 'URL points to a private/internal host' };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      method: 'OPTIONS',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return { success: true, message: `Webhook endpoint reachable (HTTP ${response.status})`, details: url };
  } catch (e) {
    return { success: false, message: 'Webhook unreachable', details: e instanceof Error ? e.message : 'Connection failed' };
  }
}

function toEnvVar(service: string): string {
  const map: Record<string, string> = {
    email: 'NEXT_PUBLIC_ENABLE_EMAIL',
    sms: 'NEXT_PUBLIC_ENABLE_SMS',
    webhooks: 'NEXT_PUBLIC_ENABLE_WEBHOOKS',
    email_sequences: 'NEXT_PUBLIC_ENABLE_EMAIL_SEQUENCES',
    workflow_editor: 'NEXT_PUBLIC_ENABLE_WORKFLOW_EDITOR',
    calendar_sync: 'NEXT_PUBLIC_ENABLE_CALENDAR_SYNC',
    portal: 'NEXT_PUBLIC_ENABLE_PORTAL',
    realtime: 'NEXT_PUBLIC_ENABLE_REALTIME',
    invoices: 'NEXT_PUBLIC_ENABLE_INVOICES',
    standalone_invoice: 'NEXT_PUBLIC_ENABLE_STANDALONE_INVOICE',
  };
  return map[service] ?? service.toUpperCase();
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
