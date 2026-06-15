-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Wave 7: Ecosystem & Polish
-- Tables: workflow_states, workflow_transitions, calendar_integrations,
--         sms_logs, portal_users, portal_shares
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- 1. WORKFLOW BUILDER (states + transitions for custom pipelines)
create table if not exists public.workflow_states (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  color      text        not null default '#6366f1',
  entity_type text       not null check (entity_type in ('lead', 'deal', 'task')),
  sort_order integer     not null default 0,
  created_by text        not null,
  created_at timestamptz not null default now()
);
alter table public.workflow_states enable row level security;
drop policy if exists "Enable all for authenticated" on public.workflow_states;
create policy "Enable all for authenticated" on public.workflow_states for all to authenticated using (true) with check (true);

create table if not exists public.workflow_transitions (
  id           uuid   primary key default gen_random_uuid(),
  from_state_id uuid  not null references public.workflow_states(id) on delete cascade,
  to_state_id   uuid  not null references public.workflow_states(id) on delete cascade,
  label        text   not null default '',
  created_at   timestamptz not null default now(),
  unique(from_state_id, to_state_id)
);
alter table public.workflow_transitions enable row level security;
drop policy if exists "Enable all for authenticated" on public.workflow_transitions;
create policy "Enable all for authenticated" on public.workflow_transitions for all to authenticated using (true) with check (true);

-- 2. CALENDAR INTEGRATIONS (OAuth token storage for sync)
create table if not exists public.calendar_integrations (
  id            uuid        primary key default gen_random_uuid(),
  provider      text        not null check (provider in ('google', 'outlook')),
  email         text        not null,
  access_token  text        not null,
  refresh_token text        null,
  expires_at    timestamptz null,
  sync_enabled  boolean     not null default true,
  last_synced_at timestamptz null,
  created_by    text        not null,
  created_at    timestamptz not null default now(),
  unique(provider, created_by)
);
alter table public.calendar_integrations enable row level security;
drop policy if exists "Enable all for authenticated" on public.calendar_integrations;
create policy "Enable all for authenticated" on public.calendar_integrations for all to authenticated using (true) with check (true);

-- 3. SMS LOGS
create table if not exists public.sms_logs (
  id              uuid        primary key default gen_random_uuid(),
  to_number       text        not null,
  from_number     text        not null,
  body            text        not null,
  direction       text        not null check (direction in ('inbound', 'outbound')),
  status          text        not null default 'sent' check (status in ('sent', 'delivered', 'failed')),
  related_to_type text        null check (related_to_type in ('lead', 'contact', 'company', 'deal')),
  related_to_id   text        null,
  created_by      text        not null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_sms_logs_related on public.sms_logs(related_to_type, related_to_id);
alter table public.sms_logs enable row level security;
drop policy if exists "Enable all for authenticated" on public.sms_logs;
create policy "Enable all for authenticated" on public.sms_logs for all to authenticated using (true) with check (true);

-- 4. PORTAL USERS (customer portal access)
create table if not exists public.portal_users (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null unique,
  name        text        not null,
  password_hash text      not null,
  last_login  timestamptz null,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);
alter table public.portal_users enable row level security;
drop policy if exists "Enable all for authenticated" on public.portal_users;
create policy "Enable all for authenticated" on public.portal_users for all to authenticated using (true) with check (true);

-- 5. PORTAL SHARES (which records a portal user can see)
create table if not exists public.portal_shares (
  id              uuid        primary key default gen_random_uuid(),
  portal_user_id  uuid        not null references public.portal_users(id) on delete cascade,
  related_to_type text        not null check (related_to_type in ('lead', 'deal', 'quote', 'ticket')),
  related_to_id   text        not null,
  permission      text        not null default 'view' check (permission in ('view', 'comment', 'edit')),
  created_at      timestamptz not null default now(),
  unique(portal_user_id, related_to_type, related_to_id)
);
alter table public.portal_shares enable row level security;
drop policy if exists "Enable all for authenticated" on public.portal_shares;
create policy "Enable all for authenticated" on public.portal_shares for all to authenticated using (true) with check (true);
