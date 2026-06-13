-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Wave 3: Communication Layer
-- Tables: email_history, call_logs, notes
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ─────────────────────────────────────────────────────────────

-- 1. EMAIL HISTORY
create table if not exists public.email_history (
  id               uuid        primary key default gen_random_uuid(),
  from_address     text        not null,
  to_address       text        not null,
  subject          text        not null default '',
  body             text        not null default '',
  direction        text        not null check (direction in ('inbound', 'outbound')),
  status           text        not null default 'sent' check (status in ('draft', 'sent', 'failed')),
  related_to_type  text        null check (related_to_type in ('lead', 'contact', 'company', 'deal')),
  related_to_id    text        null,
  sent_at          timestamptz null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_email_history_related on public.email_history(related_to_type, related_to_id);
create index if not exists idx_email_history_address on public.email_history(from_address, to_address);
create index if not exists idx_email_history_created on public.email_history(created_at desc);

alter table public.email_history enable row level security;
drop policy if exists "Enable all for authenticated users" on public.email_history;
create policy "Enable all for authenticated users" on public.email_history
  for all to authenticated using (true) with check (true);

-- 2. CALL LOGS
create table if not exists public.call_logs (
  id               uuid        primary key default gen_random_uuid(),
  direction        text        not null check (direction in ('inbound', 'outbound')),
  duration         integer     not null default 0,
  caller           text        not null,
  callee           text        not null,
  notes            text        not null default '',
  call_result      text        not null default 'completed' check (call_result in ('completed', 'no_answer', 'busy', 'failed', 'voicemail')),
  related_to_type  text        null check (related_to_type in ('lead', 'contact', 'company', 'deal')),
  related_to_id    text        null,
  created_by       text        not null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_call_logs_related on public.call_logs(related_to_type, related_to_id);
create index if not exists idx_call_logs_created on public.call_logs(created_at desc);

alter table public.call_logs enable row level security;
drop policy if exists "Enable all for authenticated users" on public.call_logs;
create policy "Enable all for authenticated users" on public.call_logs
  for all to authenticated using (true) with check (true);

-- 3. NOTES (rich text, polymorphic)
create table if not exists public.notes (
  id               uuid        primary key default gen_random_uuid(),
  title            text        not null default '',
  body             text        not null default '',
  related_to_type  text        null check (related_to_type in ('lead', 'contact', 'company', 'deal', 'task', 'meeting')),
  related_to_id    text        null,
  created_by       text        not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_notes_related on public.notes(related_to_type, related_to_id);
create index if not exists idx_notes_created_by on public.notes(created_by);

drop trigger if exists trigger_notes_updated_at on public.notes;
create trigger trigger_notes_updated_at
  before update on public.notes
  for each row execute function handle_updated_at();

alter table public.notes enable row level security;
drop policy if exists "Enable all for authenticated users" on public.notes;
create policy "Enable all for authenticated users" on public.notes
  for all to authenticated using (true) with check (true);
