-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Wave 6: Advanced Features
-- Tables: email_sequences, campaign_emails, goals, file_attachments, saved_views, api_keys
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- 1. EMAIL SEQUENCES / CAMPAIGNS
create table if not exists public.email_sequences (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  description text        not null default '',
  status      text        not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  created_by  text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trigger_email_sequences_updated_at on public.email_sequences;
create trigger trigger_email_sequences_updated_at before update on public.email_sequences for each row execute function handle_updated_at();
alter table public.email_sequences enable row level security;
drop policy if exists "Enable all for authenticated" on public.email_sequences;
create policy "Enable all for authenticated" on public.email_sequences for all to authenticated using (true) with check (true);

create table if not exists public.campaign_emails (
  id          uuid        primary key default gen_random_uuid(),
  sequence_id uuid        not null references public.email_sequences(id) on delete cascade,
  subject     text        not null,
  body        text        not null default '',
  delay_days  integer     not null default 0,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_campaign_emails_sequence on public.campaign_emails(sequence_id);
alter table public.campaign_emails enable row level security;
drop policy if exists "Enable all for authenticated" on public.campaign_emails;
create policy "Enable all for authenticated" on public.campaign_emails for all to authenticated using (true) with check (true);

-- 2. GOALS
create table if not exists public.goals (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  description text        not null default '',
  type        text        not null check (type in ('revenue', 'deals_count', 'leads_created', 'tasks_completed', 'calls_made', 'custom')),
  target      numeric     not null default 0 check (target >= 0),
  current     numeric     not null default 0,
  period      text        not null check (period in ('weekly', 'monthly', 'quarterly', 'yearly')),
  start_date  date        not null,
  end_date    date        not null,
  assigned_to text        null,
  created_by  text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_goals_assigned on public.goals(assigned_to);
create index if not exists idx_goals_period on public.goals(period);
drop trigger if exists trigger_goals_updated_at on public.goals;
create trigger trigger_goals_updated_at before update on public.goals for each row execute function handle_updated_at();
alter table public.goals enable row level security;
drop policy if exists "Enable all for authenticated" on public.goals;
create policy "Enable all for authenticated" on public.goals for all to authenticated using (true) with check (true);

-- 3. FILE ATTACHMENTS (metadata table; files stored in Supabase Storage bucket)
create table if not exists public.file_attachments (
  id              uuid        primary key default gen_random_uuid(),
  filename        text        not null,
  original_name   text        not null,
  mime_type       text        not null default 'application/octet-stream',
  size_bytes      integer     not null default 0,
  storage_path    text        not null,
  related_to_type text        null check (related_to_type in ('lead', 'contact', 'company', 'deal', 'task', 'meeting', 'quote')),
  related_to_id   text        null,
  uploaded_by     text        not null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_file_attachments_related on public.file_attachments(related_to_type, related_to_id);
alter table public.file_attachments enable row level security;
drop policy if exists "Enable all for authenticated" on public.file_attachments;
create policy "Enable all for authenticated" on public.file_attachments for all to authenticated using (true) with check (true);

-- 4. SAVED VIEWS (per-user filter presets)
create table if not exists public.saved_views (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  entity_type text        not null check (entity_type in ('lead', 'contact', 'company', 'deal', 'task', 'meeting')),
  filters     jsonb       not null default '{}'::jsonb,
  sort_by     text        null,
  sort_order  text        null check (sort_order in ('asc', 'desc')),
  created_by  text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(name, entity_type, created_by)
);
drop trigger if exists trigger_saved_views_updated_at on public.saved_views;
create trigger trigger_saved_views_updated_at before update on public.saved_views for each row execute function handle_updated_at();
alter table public.saved_views enable row level security;
drop policy if exists "Enable all for authenticated" on public.saved_views;
create policy "Enable all for authenticated" on public.saved_views for all to authenticated using (true) with check (true);

-- 5. API KEYS
create table if not exists public.api_keys (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  key_prefix  text        not null,
  key_hash    text        not null,
  scopes      jsonb       not null default '["read"]'::jsonb,
  last_used_at timestamptz null,
  expires_at  timestamptz null,
  created_by  text        not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_api_keys_created_by on public.api_keys(created_by);
alter table public.api_keys enable row level security;
drop policy if exists "Enable all for authenticated" on public.api_keys;
create policy "Enable all for authenticated" on public.api_keys for all to authenticated using (true) with check (true);
