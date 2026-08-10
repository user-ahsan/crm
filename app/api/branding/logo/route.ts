import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseUrl } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';
import { validateCsrf } from '@/lib/csrf';

const BUCKET = 'organization-logos';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];

/**
 * POST /api/branding/logo — upload a new logo
 * Body: multipart/form-data with field "file"
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!validateCsrf(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400, headers: corsHeaders() });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`,
      }, { status: 400, headers: corsHeaders() });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'File too large. Maximum size is 5MB.',
      }, { status: 400, headers: corsHeaders() });
    }

    // Delete existing logo first (silent if none)
    const { data: existing } = await supabase
      .from('branding_settings')
      .select('logo_path')
      .eq('organization_id', 'default')
      .maybeSingle();

    if (existing?.logo_path) {
      await supabase.storage.from(BUCKET).remove([existing.logo_path]);
    }

    // Upload new logo
    const ext = file.name.split('.').pop() || 'png';
    const filePath = `logos/${user.id}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500, headers: corsHeaders() });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    const logoUrl = publicUrlData?.publicUrl || `${getSupabaseUrl()}/storage/v1/object/public/${BUCKET}/${filePath}`;

    // Save to branding_settings
    const { error: dbError } = await supabase
      .from('branding_settings')
      .upsert({
        organization_id: 'default',
        logo_url: logoUrl,
        logo_path: filePath,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }, { onConflict: 'organization_id' });

    if (dbError) {
      // Clean up uploaded file on DB failure
      await supabase.storage.from(BUCKET).remove([filePath]);
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({
      success: true,
      data: { logo_url: logoUrl, logo_path: filePath },
    }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * DELETE /api/branding/logo — remove the logo
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!validateCsrf(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    // Get current logo path
    const { data: branding } = await supabase
      .from('branding_settings')
      .select('logo_path')
      .eq('organization_id', 'default')
      .maybeSingle();

    if (branding?.logo_path) {
      await supabase.storage.from(BUCKET).remove([branding.logo_path]);
    }

    // Clear the DB record
    const { error } = await supabase
      .from('branding_settings')
      .upsert({
        organization_id: 'default',
        logo_url: null,
        logo_path: null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }, { onConflict: 'organization_id' });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders() });
}
