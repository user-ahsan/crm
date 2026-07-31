import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseUrl } from '@/lib/supabase/client';
import { corsHeaders } from '@/lib/cors';
import { validateCsrf } from '@/lib/csrf';
import { isPrivateHost } from '@/lib/ssrf';
import type { ServiceName } from '@/lib/service-config';

const ALLOWED_SERVICES: ServiceName[] = [
  'email', 'sms', 'webhooks', 'email_sequences', 'workflow_editor',
  'calendar_sync', 'portal', 'realtime', 'invoices', 'standalone_invoice',
];

/**
 * GET /api/service-config/{service}
 * Returns the current config for a service (with secrets masked).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> },
): Promise<NextResponse> {
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

    const { data, error } = await supabase
      .from('service_configs')
      .select('config, updated_at')
      .eq('service', service)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }

    // Mask sensitive values for display
    const config = (data?.config ?? {}) as Record<string, string>;
    const masked = { ...config };
    for (const key of Object.keys(masked)) {
      if (['api_key', 'auth_token', 'webhook_secret', 'client_secret'].some(s => key.toLowerCase().includes(s))) {
        if (masked[key] && masked[key].length > 8) {
          masked[key] = masked[key].slice(0, 4) + '••••' + masked[key].slice(-4);
        } else if (masked[key]) {
          masked[key] = '••••••••';
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        config: masked,
        _has_config: Object.keys(config).length > 0 && Object.values(config).some(v => v && v !== ''),
        updated_at: data?.updated_at ?? null,
      },
    }, { headers: corsHeaders() });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * PUT /api/service-config/{service}
 * Saves service config to Supabase.
 */
export async function PUT(
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

    const body = await request.json();
    const { config } = body;
    if (!config || typeof config !== 'object') {
      return NextResponse.json({ success: false, error: 'Config object required' }, { status: 400, headers: corsHeaders() });
    }

    // Validate webhook URLs for SSRF safety
    if (service === 'webhooks' && config.webhook_url) {
      try {
        new URL(config.webhook_url);
        if (isPrivateHost(config.webhook_url)) {
          return NextResponse.json({ success: false, error: 'Webhook URL must be a public endpoint' }, { status: 400, headers: corsHeaders() });
        }
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid webhook URL' }, { status: 400, headers: corsHeaders() });
      }
    }

    // Strip masked values (e.g. "abcd••••efgh" or "••••••••") so UI
    // placeholders never overwrite real secrets with their masked display.
    const cleanConfig: Record<string, string> = {};
    for (const [key, val] of Object.entries(config)) {
      if (typeof val !== 'string') continue;
      if (val.includes('••••') || val === '••••••••') continue; // masked placeholder — skip
      cleanConfig[key] = val.trim();
    }

    // Merge with existing config (preserves untouched secrets)
    const { data: existing } = await supabase
      .from('service_configs')
      .select('config')
      .eq('service', service)
      .maybeSingle();

    const mergedConfig = { ...((existing?.config as Record<string, string>) ?? {}), ...cleanConfig };

    const { error } = await supabase.from('service_configs').upsert(
      {
        service,
        config: mergedConfig,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'service' },
    );

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
