-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Full Database Setup (idempotent - safe to re-run)
-- ─────────────────────────────────────────────────────────────
-- Run this entire file in the Supabase SQL Editor using
-- the RUN button (▶), NOT the Explain button (📊).
--
-- All statements use IF NOT EXISTS / OR REPLACE / DROP IF EXISTS
-- so this script is safe to run multiple times.
-- ─────────────────────────────────────────────────────────────

-- 0. EXTENSION
create extension if not exists "pgcrypto";

-- 1. UPDATED_AT TRIGGER FUNCTION
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
  owner_id        uuid         null,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source in ('manual', 'website', 'referral', 'ads', 'social'));
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost'));
alter table public.leads drop constraint if exists leads_priority_check;
alter table public.leads add constraint leads_priority_check check (priority in ('low', 'medium', 'high'));
create index if not exists idx_leads_status on public.leads (status);
create index if not exists idx_leads_source on public.leads (source);
create index if not exists idx_leads_assigned_to on public.leads (assigned_to);
create index if not exists idx_leads_created_at on public.leads (created_at desc);
drop trigger if exists trigger_leads_updated_at on public.leads;
create trigger trigger_leads_updated_at before update on public.leads for each row execute function handle_updated_at();

-- 3. COMPANIES TABLE
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

alter table public.companies drop constraint if exists companies_size_check;
alter table public.companies add constraint companies_size_check check (size in ('1-10', '11-50', '51-200', '201-1000', '1000+'));
create index if not exists idx_companies_name on public.companies (name);
create index if not exists idx_companies_industry on public.companies (industry);
drop trigger if exists trigger_companies_updated_at on public.companies;
create trigger trigger_companies_updated_at before update on public.companies for each row execute function handle_updated_at();

-- 4. CONTACTS TABLE
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

create index if not exists idx_contacts_email on public.contacts (email);
create index if not exists idx_contacts_company_id on public.contacts (company_id);
create index if not exists idx_contacts_name on public.contacts (name);
drop trigger if exists trigger_contacts_updated_at on public.contacts;
create trigger trigger_contacts_updated_at before update on public.contacts for each row execute function handle_updated_at();

-- 5. TASKS TABLE
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

alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check check (priority in ('low', 'medium', 'high', 'critical'));
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (status in ('pending', 'completed', 'overdue'));
alter table public.tasks drop constraint if exists tasks_related_type_check;
alter table public.tasks add constraint tasks_related_type_check check (related_to_type in ('lead', 'contact', 'company'));
create index if not exists idx_tasks_status on public.tasks (status);
create index if not exists idx_tasks_due_date on public.tasks (due_date);
create index if not exists idx_tasks_related on public.tasks (related_to_type, related_to_id);
create index if not exists idx_tasks_assigned_to on public.tasks (assigned_to);
drop trigger if exists trigger_tasks_updated_at on public.tasks;
create trigger trigger_tasks_updated_at before update on public.tasks for each row execute function handle_updated_at();

-- 6. MEETINGS TABLE
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

alter table public.meetings drop constraint if exists meetings_type_check;
alter table public.meetings add constraint meetings_type_check check (type in ('online', 'offline', 'call'));
create index if not exists idx_meetings_date_time on public.meetings (date_time);
create index if not exists idx_meetings_related on public.meetings (related_to_type, related_to_id);
create index if not exists idx_meetings_type on public.meetings (type);
drop trigger if exists trigger_meetings_updated_at on public.meetings;
create trigger trigger_meetings_updated_at before update on public.meetings for each row execute function handle_updated_at();

-- 7. ACTIVITIES TABLE
create table if not exists public.activities (
  id          uuid         primary key default gen_random_uuid(),
  entity_type text         not null,
  entity_id   uuid         not null,
  type        text         not null,
  description text         not null,
  timestamp   timestamptz  not null default now(),
  metadata    jsonb        null
);

create index if not exists idx_activities_entity on public.activities (entity_type, entity_id);
create index if not exists idx_activities_timestamp on public.activities (timestamp desc);
create index if not exists idx_activities_type on public.activities (type);

-- 8. TEAMS TABLE
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null,
  invite_code text not null default upper(substring(gen_random_uuid()::text from 1 for 8)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teams_created_by on public.teams(created_by);
create index if not exists idx_teams_invite_code on public.teams(invite_code);
drop trigger if exists trigger_teams_updated_at on public.teams;
create trigger trigger_teams_updated_at before update on public.teams for each row execute function handle_updated_at();

-- 9. TEAM MEMBERS TABLE
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('admin', 'manager', 'agent', 'viewer')),
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create index if not exists idx_team_members_team_id on public.team_members(team_id);
create index if not exists idx_team_members_user_id on public.team_members(user_id);

-- 10. TEAM INVITATIONS TABLE
create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'manager', 'agent', 'viewer')),
  invited_by uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now()
);

create index if not exists idx_team_invitations_team_id on public.team_invitations(team_id);
create index if not exists idx_team_invitations_email on public.team_invitations(email);
create index if not exists idx_team_invitations_status on public.team_invitations(status);

-- 11. RLS POLICIES (all use drop if exists for idempotency)
alter table public.leads enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.tasks enable row level security;
alter table public.meetings enable row level security;
alter table public.activities enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invitations enable row level security;

-- Leads
drop policy if exists "Enable all for authenticated users" on public.leads;
create policy "Enable all for authenticated users" on public.leads for all to authenticated using (true) with check (true);

-- Companies
drop policy if exists "Enable all for authenticated users" on public.companies;
create policy "Enable all for authenticated users" on public.companies for all to authenticated using (true) with check (true);

-- Contacts
drop policy if exists "Enable all for authenticated users" on public.contacts;
create policy "Enable all for authenticated users" on public.contacts for all to authenticated using (true) with check (true);

-- Tasks
drop policy if exists "Enable all for authenticated users" on public.tasks;
create policy "Enable all for authenticated users" on public.tasks for all to authenticated using (true) with check (true);

-- Meetings
drop policy if exists "Enable all for authenticated users" on public.meetings;
create policy "Enable all for authenticated users" on public.meetings for all to authenticated using (true) with check (true);

-- Activities
drop policy if exists "Enable all for authenticated users" on public.activities;
create policy "Enable all for authenticated users" on public.activities for all to authenticated using (true) with check (true);

-- Teams
drop policy if exists "Users can view teams they belong to" on public.teams;
create policy "Users can view teams they belong to" on public.teams for select to authenticated using (
  id in (select team_id from public.team_members where user_id = auth.uid()::text)
  or created_by = auth.uid()
);
drop policy if exists "Authenticated users can create teams" on public.teams;
create policy "Authenticated users can create teams" on public.teams for insert to authenticated with check (true);
drop policy if exists "Team admins can update their team" on public.teams;
create policy "Team admins can update their team" on public.teams for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

-- Team Members
drop policy if exists "Team members can view team roster" on public.team_members;
create policy "Team members can view team roster" on public.team_members for select to authenticated using (
  team_id in (select team_id from public.team_members where user_id = auth.uid()::text)
);
drop policy if exists "Users can add themselves as members" on public.team_members;
create policy "Users can add themselves as members" on public.team_members for insert to authenticated with check (user_id = auth.uid()::text);
drop policy if exists "Team admins can add members" on public.team_members;
create policy "Team admins can add members" on public.team_members for insert to authenticated with check (
  exists (select 1 from public.team_members where team_id = team_members.team_id and user_id = auth.uid()::text and role = 'admin')
);
drop policy if exists "Team admins can update members" on public.team_members;
create policy "Team admins can update members" on public.team_members for update to authenticated using (
  exists (select 1 from public.team_members where team_id = team_members.team_id and user_id = auth.uid()::text and role = 'admin')
);
drop policy if exists "Team admins can delete members" on public.team_members;
create policy "Team admins can delete members" on public.team_members for delete to authenticated using (
  exists (select 1 from public.team_members where team_id = team_members.team_id and user_id = auth.uid()::text and role = 'admin')
);

-- Team Invitations
drop policy if exists "Members can view invitations" on public.team_invitations;
create policy "Members can view invitations" on public.team_invitations for select to authenticated using (
  team_id in (select team_id from public.team_members where user_id = auth.uid()::text)
);
drop policy if exists "Admins can manage invitations" on public.team_invitations;
create policy "Admins can manage invitations" on public.team_invitations for all to authenticated using (
  exists (select 1 from public.team_members where team_id = team_invitations.team_id and user_id = auth.uid()::text and role = 'admin')
);

-- ─────────────────────────────────────────────────────────────
-- Full database setup complete.
-- Safe to re-run — all statements use IF NOT EXISTS / 
-- DROP IF EXISTS / OR REPLACE patterns.
-- ─────────────────────────────────────────────────────────────
