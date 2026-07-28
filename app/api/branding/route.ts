import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/client';
import { corsHeaders } from '@/lib/cors';
import { validateCsrf } from '@/lib/csrf';

/**
 * GET /api/branding — returns the current branding settings (logo URL, company name)
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const { data, error } = await supabase
      .from('branding_settings')
      .select('*')
      .eq('organization_id', 'default')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({
      success: true,
      data: data ?? { logo_url: null, logo_path: null, company_name: null },
    }, { headers: corsHeaders() });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * PUT /api/branding — updates branding settings (company name)
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!validateCsrf(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const body = await request.json();
    const { company_name } = body;

    const { data, error } = await supabase
      .from('branding_settings')
      .upsert({
        organization_id: 'default',
        company_name: company_name ?? null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }, { onConflict: 'organization_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ success: true, data }, { headers: corsHeaders() });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
