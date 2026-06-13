-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Initial Schema Migration
-- ─────────────────────────────────────────────────────────────
-- Creates all six core tables with constraints, indexes,
-- RLS policies, and the automatic updated_at trigger.
-- ─────────────────────────────────────────────────────────────

-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- 1. UPDATED_AT TRIGGER FUNCTION
-- ─────────────────────────────────────────────────────────────
create or replace function handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. LEADS TABLE
-- ─────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id              uuid         primary key default gen_random_uuid(),
  full_name       text         not null,
  email           text         null,
  phone           text         null,
  company_name    text         null,
  industry        text         null,
  country         text         null,
  source          text         not null default 'manual',
  status          text         not null default 'new',
  priority        text         not null default 'medium',
  assigned_to     text         null,
  estimated_value numeric      not null default 0,
  tags            text[]       not null default '{}',
  notes           text         null,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

-- Constraints
alter table public.leads
  add constraint leads_source_check
  check (source in ('manual', 'website', 'referral', 'ads', 'social'));

alter table public.leads
  add constraint leads_status_check
  check (status in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost'));

alter table public.leads
  add constraint leads_priority_check
  check (priority in ('low', 'medium', 'high'));

-- Indexes
create index if not exists idx_leads_status      on public.leads (status);
create index if not exists idx_leads_source      on public.leads (source);
create index if not exists idx_leads_assigned_to on public.leads (assigned_to);
create index if not exists idx_leads_created_at  on public.leads (created_at desc);

-- Trigger
create trigger trigger_leads_updated_at
  before update on public.leads
  for each row
  execute function handle_updated_at();

-- RLS
alter table public.leads enable row level security;

create policy "Authenticated users can read leads"
  on public.leads for select
  to authenticated
  using (true);

create policy "Authenticated users can insert leads"
  on public.leads for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update leads"
  on public.leads for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete leads"
  on public.leads for delete
  to authenticated
  using (true);

-- 3. COMPANIES TABLE
-- ─────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id            uuid         primary key default gen_random_uuid(),
  name          text         not null,
  industry      text         null,
  size          text         null,
  revenue       numeric      not null default 0,
  location      text         null,
  website       text         null,
  contact_ids   uuid[]       not null default '{}',
  lead_ids      uuid[]       not null default '{}',
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

-- Constraints
alter table public.companies
  add constraint companies_size_check
  check (size in ('1-10', '11-50', '51-200', '201-1000', '1000+'));

-- Indexes
create index if not exists idx_companies_name     on public.companies (name);
create index if not exists idx_companies_industry on public.companies (industry);

-- Trigger
create trigger trigger_companies_updated_at
  before update on public.companies
  for each row
  execute function handle_updated_at();

-- RLS
alter table public.companies enable row level security;

create policy "Authenticated users can read companies"
  on public.companies for select
  to authenticated
  using (true);

create policy "Authenticated users can insert companies"
  on public.companies for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update companies"
  on public.companies for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete companies"
  on public.companies for delete
  to authenticated
  using (true);

-- 4. CONTACTS TABLE
-- ─────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id           uuid         primary key default gen_random_uuid(),
  name         text         not null,
  email        text         null,
  phone        text         null,
  job_title    text         null,
  company_id   uuid         null references public.companies(id) on delete set null,
  lead_ids     uuid[]       not null default '{}',
  location     text         null,
  social_links text[]       not null default '{}',
  tags         text[]       not null default '{}',
  notes        text         null,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- Indexes
create index if not exists idx_contacts_email      on public.contacts (email);
create index if not exists idx_contacts_company_id on public.contacts (company_id);
create index if not exists idx_contacts_name       on public.contacts (name);

-- Trigger
create trigger trigger_contacts_updated_at
  before update on public.contacts
  for each row
  execute function handle_updated_at();

-- RLS
alter table public.contacts enable row level security;

create policy "Authenticated users can read contacts"
  on public.contacts for select
  to authenticated
  using (true);

create policy "Authenticated users can insert contacts"
  on public.contacts for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update contacts"
  on public.contacts for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete contacts"
  on public.contacts for delete
  to authenticated
  using (true);

-- 5. TASKS TABLE
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id               uuid         primary key default gen_random_uuid(),
  title            text         not null,
  description      text         null,
  related_to_type  text         null,
  related_to_id    uuid         null,
  assigned_to      text         null,
  due_date         timestamptz  null,
  priority         text         not null default 'medium',
  status           text         not null default 'pending',
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

-- Constraints
alter table public.tasks
  add constraint tasks_priority_check
  check (priority in ('low', 'medium', 'high', 'critical'));

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('pending', 'completed', 'overdue'));

alter table public.tasks
  add constraint tasks_related_type_check
  check (related_to_type in ('lead', 'contact', 'company'));

-- Indexes
create index if not exists idx_tasks_status     on public.tasks (status);
create index if not exists idx_tasks_due_date   on public.tasks (due_date);
create index if not exists idx_tasks_related    on public.tasks (related_to_type, related_to_id);
create index if not exists idx_tasks_assigned_to on public.tasks (assigned_to);

-- Trigger
create trigger trigger_tasks_updated_at
  before update on public.tasks
  for each row
  execute function handle_updated_at();

-- RLS
alter table public.tasks enable row level security;

create policy "Authenticated users can read tasks"
  on public.tasks for select
  to authenticated
  using (true);

create policy "Authenticated users can insert tasks"
  on public.tasks for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update tasks"
  on public.tasks for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete tasks"
  on public.tasks for delete
  to authenticated
  using (true);

-- 6. MEETINGS TABLE
-- ─────────────────────────────────────────────────────────────
create table if not exists public.meetings (
  id               uuid         primary key default gen_random_uuid(),
  title            text         not null,
  participants     text[]       not null default '{}',
  related_to_type  text         null,
  related_to_id    uuid         null,
  date_time        timestamptz  not null,
  duration         integer      not null default 30,
  type             text         not null default 'online',
  notes            text         null,
  outcome          text         null,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

-- Constraints
alter table public.meetings
  add constraint meetings_type_check
  check (type in ('online', 'offline', 'call'));

-- Indexes
create index if not exists idx_meetings_date_time on public.meetings (date_time);
create index if not exists idx_meetings_related   on public.meetings (related_to_type, related_to_id);
create index if not exists idx_meetings_type      on public.meetings (type);

-- Trigger
create trigger trigger_meetings_updated_at
  before update on public.meetings
  for each row
  execute function handle_updated_at();

-- RLS
alter table public.meetings enable row level security;

create policy "Authenticated users can read meetings"
  on public.meetings for select
  to authenticated
  using (true);

create policy "Authenticated users can insert meetings"
  on public.meetings for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update meetings"
  on public.meetings for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete meetings"
  on public.meetings for delete
  to authenticated
  using (true);

-- 7. ACTIVITIES TABLE
-- ─────────────────────────────────────────────────────────────
create table if not exists public.activities (
  id          uuid         primary key default gen_random_uuid(),
  entity_type text         not null,
  entity_id   uuid         not null,
  type        text         not null,
  description text         not null,
  timestamp   timestamptz  not null default now(),
  metadata    jsonb        null
);

-- Indexes
create index if not exists idx_activities_entity    on public.activities (entity_type, entity_id);
create index if not exists idx_activities_timestamp on public.activities (timestamp desc);
create index if not exists idx_activities_type      on public.activities (type);

-- RLS
alter table public.activities enable row level security;

create policy "Authenticated users can read activities"
  on public.activities for select
  to authenticated
  using (true);

create policy "Authenticated users can insert activities"
  on public.activities for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update activities"
  on public.activities for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete activities"
  on public.activities for delete
  to authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────
-- Migration complete
-- ─────────────────────────────────────────────────────────────
