-- ─── Migration 00008: Branding Settings + Service Configs ───────────────
-- Adds:
--   1. branding_settings table (logo URL, company name per organization)
--   2. organization-logos storage bucket for logo files
--   3. service_configs table (UI-configured external service credentials)
--   4. RLS policies for both tables
--   5. Storage bucket RLS policies
-- ────────────────────────────────────────────────────────────────────────

-- ── 1. Branding Settings ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.branding_settings (
  id bigint primary key generated always as identity,
  organization_id text not null default 'default',
  logo_url text,
  logo_path text,
  company_name text,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id),
  constraint branding_settings_org_unique unique (organization_id)
);

ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branding_select_policy" ON public.branding_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "branding_insert_policy" ON public.branding_settings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "branding_update_policy" ON public.branding_settings
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "branding_delete_policy" ON public.branding_settings
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── 2. Organization Logos Storage Bucket ────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-logos',
  'organization-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "logos_upload_policy" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'organization-logos' AND auth.role() = 'authenticated'
  );

CREATE POLICY "logos_select_policy" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'organization-logos' AND auth.role() = 'authenticated'
  );

CREATE POLICY "logos_delete_policy" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'organization-logos' AND auth.role() = 'authenticated'
  );

CREATE POLICY "logos_update_policy" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'organization-logos' AND auth.role() = 'authenticated'
  );

-- ── 3. Service Configs (UI-Configured External Services) ────────────────

CREATE TABLE IF NOT EXISTS public.service_configs (
  id bigint primary key generated always as identity,
  service text not null,
  config jsonb not null default '{}',
  created_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz default now(),
  constraint service_configs_service_key unique (service)
);

ALTER TABLE public.service_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_configs_select" ON public.service_configs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "service_configs_insert" ON public.service_configs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "service_configs_update" ON public.service_configs
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "service_configs_delete" ON public.service_configs
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── End of migration ───────────────────────────────────────────────────
