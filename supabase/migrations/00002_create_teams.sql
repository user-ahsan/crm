-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Teams & Collaboration Migration
-- ─────────────────────────────────────────────────────────────

-- Teams table
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

-- Team members table
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('admin', 'manager', 'agent', 'viewer')),
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create index if not exists idx_team_members_team_id on public.team_members(team_id);
create index if not exists idx_team_members_user_id on public.team_members(user_id);

-- Team invitations table
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

-- Add user_id column to leads for ownership
alter table public.leads add column if not exists owner_id uuid;

-- Triggers
create trigger trigger_teams_updated_at
  before update on public.teams
  for each row execute function handle_updated_at();

-- RLS Policies
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invitations enable row level security;

create policy "Users can view teams they belong to"
  on public.teams for select
  to authenticated
  using (
    id in (select team_id from public.team_members where user_id = auth.uid())
    or created_by = auth.uid()
  );

create policy "Team admins can update their team"
  on public.teams for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Team members can view team roster"
  on public.team_members for select
  to authenticated
  using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Team admins can manage members"
  on public.team_members for insert
  to authenticated
  with check (
    exists (
      select 1 from public.team_members
      where team_id = team_members.team_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy "Team admins can update members"
  on public.team_members for update
  to authenticated
  using (
    exists (
      select 1 from public.team_members
      where team_id = team_members.team_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy "Team admins can delete members"
  on public.team_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.team_members
      where team_id = team_members.team_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );
