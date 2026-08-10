-- ═══════════════════════════════════════════════════════════════
-- NexusCRM – Role-Scoped RLS (replaces blanket team-wide CRUD)
-- Migration date: 2026-07-31
--
-- Replaces the `is_any_team_member()` policies from
-- 20260726_rls_policies.sql (and the older owner/team policies from
-- 00001_initial_schema.sql + wide-open policies from 00005/00006)
-- with role-scoped policies implementing the FEATURES feature-21
-- permission matrix:
--
--   | Role    | Leads/Contacts/Tasks/Meetings/Deals/Quotes/Campaigns | Companies |
--   |---------|------------------------------------------------------|-----------|
--   | Admin   | CRUD all                                             | CRUD all  |
--   | Manager | CRUD all (team)                                      | CRUD all  |
--   | Agent   | CRUD own                                             | Read team |
--   | Viewer  | Read all (no mutation)                                | Read all  |
--
-- The matrix is implemented by two helpers:
--   - public.team_role()          – current user's role in their team
--   - public.can_access_scope()   – role/scope/ownership decision
--
-- Idempotent: every policy it replaces is DROP IF EXISTS'd first, and
-- every create uses DROP IF EXISTS + CREATE. Safe to re-run.
--
-- Deliberately NOT re-scoped (kept from 20260726 hardening):
--   activities, tags, taggings, email_history, call_logs, notes,
--   deal_stages, lead_scores, quote_items, forecasts, goals,
--   file_attachments, workflow_states, workflow_transitions,
--   sms_logs, portal_users, portal_shares, saved_views, api_keys,
--   calendar_integrations, rate_limits (service-role only).
--   These are supporting/config tables outside the feature-21 matrix;
--   their existing team-scoped / owner-scoped hardening is preserved.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 0. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Current user's role in their team (single-team product model —
-- a multi-team user resolves to their first membership row, matching
-- the existing get_current_user_team_id() / service behaviour).
create or replace function public.team_role()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select role
  from public.team_members
  where user_id = auth.uid()::text
  limit 1;
$$;

-- Role/scope/ownership decision per FEATURES feature 21.
--
-- Params are TEXT so callers can pass `assigned_to`/`created_by`
-- columns directly — those columns hold uuid-strings OR the literal
-- 'system', so casting to uuid would raise and kill the policy.
--
--   scope            – 'own' | 'team' | 'all'  (the required scope)
--   owner_id         – record owner id (uuid::text), nullable
--   assignee_id      – record assignee id (text), nullable
--   allow_agent_team – agent may access at 'team' scope read-only
--                      (used ONLY for companies per the matrix)
--
--   admin:   any scope = true
--   manager: 'team'/'all' = true; 'own' = owner/assignee is the user
--   agent:   'own' = owner/assignee is the user;
--            'team' = true only when allow_agent_team
--   viewer:  always false (viewer SELECT is granted per-entity via
--            `team_role() = 'viewer'`; viewer mutation is denied here)
--   anon:    auth.uid() is null → false
create or replace function public.can_access_scope(
  scope text,
  owner_id text default null,
  assignee_id text default null,
  allow_agent_team boolean default false
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when auth.uid() is null then false
    when (select public.team_role()) = 'admin' then true
    when (select public.team_role()) = 'manager' then
      scope in ('team', 'all')
      or (scope = 'own' and (owner_id = auth.uid()::text or assignee_id = auth.uid()::text))
    when (select public.team_role()) = 'agent' then
      (scope = 'own' and (owner_id = auth.uid()::text or assignee_id = auth.uid()::text))
      or (scope = 'team' and allow_agent_team)
    else false
  end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 1. OWNERSHIP COLUMNS (so agent "CRUD own" is enforceable)
--    Defaults use auth.uid() so rows created through the existing
--    services (which never set owner_id) are owned by their creator.
-- ═══════════════════════════════════════════════════════════════

alter table public.leads alter column owner_id set default auth.uid();

alter table public.contacts add column if not exists owner_id uuid default auth.uid();

alter table public.tasks add column if not exists owner_id uuid default auth.uid();

alter table public.meetings add column if not exists owner_id uuid default auth.uid();

-- quotes.created_by is NOT NULL but quote.service omits it — give it a
-- creator default so agent-owned quotes are creatable and enforceable.
alter table public.quotes alter column created_by set default auth.uid()::text;

-- ═══════════════════════════════════════════════════════════════
-- 2. LEADS
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.leads;
drop policy if exists "Team members can view leads" on public.leads;
drop policy if exists "Team members can insert leads" on public.leads;
drop policy if exists "Team members can update leads" on public.leads;
drop policy if exists "Team members can delete leads" on public.leads;
drop policy if exists "select_own_leads" on public.leads;
drop policy if exists "insert_team_leads" on public.leads;
drop policy if exists "update_own_leads" on public.leads;
drop policy if exists "delete_own_leads" on public.leads;

create policy "Role scoped view leads" on public.leads
  for select to authenticated using (
    team_role() = 'viewer'
    or can_access_scope('own', owner_id::text, assigned_to)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped insert leads" on public.leads
  for insert to authenticated with check (
    can_access_scope('own', owner_id::text, assigned_to)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped update leads" on public.leads
  for update to authenticated
  using (can_access_scope('own', owner_id::text, assigned_to) or can_access_scope('team', null, null))
  with check (can_access_scope('own', owner_id::text, assigned_to) or can_access_scope('team', null, null));
create policy "Role scoped delete leads" on public.leads
  for delete to authenticated using (
    can_access_scope('own', owner_id::text, assigned_to)
    or can_access_scope('team', null, null)
  );

-- ═══════════════════════════════════════════════════════════════
-- 3. COMPANIES  (agent = read team only — no write per matrix)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.companies;
drop policy if exists "Team members can view companies" on public.companies;
drop policy if exists "Team members can insert companies" on public.companies;
drop policy if exists "Team members can update companies" on public.companies;
drop policy if exists "Team members can delete companies" on public.companies;
drop policy if exists "select_team_companies" on public.companies;
drop policy if exists "insert_team_companies" on public.companies;
drop policy if exists "update_team_companies" on public.companies;
drop policy if exists "delete_team_companies" on public.companies;

create policy "Role scoped view companies" on public.companies
  for select to authenticated using (
    team_role() = 'viewer'
    or can_access_scope('team', null, null, true)
  );
create policy "Role scoped insert companies" on public.companies
  for insert to authenticated with check (
    can_access_scope('team', null, null)
  );
create policy "Role scoped update companies" on public.companies
  for update to authenticated
  using (can_access_scope('team', null, null))
  with check (can_access_scope('team', null, null));
create policy "Role scoped delete companies" on public.companies
  for delete to authenticated using (
    can_access_scope('team', null, null)
  );

-- ═══════════════════════════════════════════════════════════════
-- 4. CONTACTS
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.contacts;
drop policy if exists "Team members can view contacts" on public.contacts;
drop policy if exists "Team members can insert contacts" on public.contacts;
drop policy if exists "Team members can update contacts" on public.contacts;
drop policy if exists "Team members can delete contacts" on public.contacts;
drop policy if exists "select_team_contacts" on public.contacts;
drop policy if exists "insert_team_contacts" on public.contacts;
drop policy if exists "update_team_contacts" on public.contacts;
drop policy if exists "delete_team_contacts" on public.contacts;

create policy "Role scoped view contacts" on public.contacts
  for select to authenticated using (
    team_role() = 'viewer'
    or can_access_scope('own', owner_id::text, null)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped insert contacts" on public.contacts
  for insert to authenticated with check (
    can_access_scope('own', owner_id::text, null)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped update contacts" on public.contacts
  for update to authenticated
  using (can_access_scope('own', owner_id::text, null) or can_access_scope('team', null, null))
  with check (can_access_scope('own', owner_id::text, null) or can_access_scope('team', null, null));
create policy "Role scoped delete contacts" on public.contacts
  for delete to authenticated using (
    can_access_scope('own', owner_id::text, null)
    or can_access_scope('team', null, null)
  );

-- ═══════════════════════════════════════════════════════════════
-- 5. TASKS
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.tasks;
drop policy if exists "Team members can view tasks" on public.tasks;
drop policy if exists "Team members can insert tasks" on public.tasks;
drop policy if exists "Team members can update tasks" on public.tasks;
drop policy if exists "Team members can delete tasks" on public.tasks;
drop policy if exists "select_own_tasks" on public.tasks;
drop policy if exists "insert_team_tasks" on public.tasks;
drop policy if exists "update_own_tasks" on public.tasks;
drop policy if exists "delete_own_tasks" on public.tasks;

create policy "Role scoped view tasks" on public.tasks
  for select to authenticated using (
    team_role() = 'viewer'
    or can_access_scope('own', owner_id::text, assigned_to)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped insert tasks" on public.tasks
  for insert to authenticated with check (
    can_access_scope('own', owner_id::text, assigned_to)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped update tasks" on public.tasks
  for update to authenticated
  using (can_access_scope('own', owner_id::text, assigned_to) or can_access_scope('team', null, null))
  with check (can_access_scope('own', owner_id::text, assigned_to) or can_access_scope('team', null, null));
create policy "Role scoped delete tasks" on public.tasks
  for delete to authenticated using (
    can_access_scope('own', owner_id::text, assigned_to)
    or can_access_scope('team', null, null)
  );

-- ═══════════════════════════════════════════════════════════════
-- 6. MEETINGS
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.meetings;
drop policy if exists "Team members can view meetings" on public.meetings;
drop policy if exists "Team members can insert meetings" on public.meetings;
drop policy if exists "Team members can update meetings" on public.meetings;
drop policy if exists "Team members can delete meetings" on public.meetings;
drop policy if exists "select_team_meetings" on public.meetings;
drop policy if exists "insert_team_meetings" on public.meetings;
drop policy if exists "update_team_meetings" on public.meetings;
drop policy if exists "delete_team_meetings" on public.meetings;

create policy "Role scoped view meetings" on public.meetings
  for select to authenticated using (
    team_role() = 'viewer'
    or can_access_scope('own', owner_id::text, null)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped insert meetings" on public.meetings
  for insert to authenticated with check (
    can_access_scope('own', owner_id::text, null)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped update meetings" on public.meetings
  for update to authenticated
  using (can_access_scope('own', owner_id::text, null) or can_access_scope('team', null, null))
  with check (can_access_scope('own', owner_id::text, null) or can_access_scope('team', null, null));
create policy "Role scoped delete meetings" on public.meetings
  for delete to authenticated using (
    can_access_scope('own', owner_id::text, null)
    or can_access_scope('team', null, null)
  );

-- ═══════════════════════════════════════════════════════════════
-- 7. DEALS  (created_by text — set by deal.service from session;
--    assigned_to text — optional form value)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.deals;
drop policy if exists "Team members can view deals" on public.deals;
drop policy if exists "Users can insert deals" on public.deals;
drop policy if exists "Team members can update deals" on public.deals;
drop policy if exists "Team members can delete deals" on public.deals;

create policy "Role scoped view deals" on public.deals
  for select to authenticated using (
    team_role() = 'viewer'
    or can_access_scope('own', created_by, assigned_to)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped insert deals" on public.deals
  for insert to authenticated with check (
    can_access_scope('own', created_by, assigned_to)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped update deals" on public.deals
  for update to authenticated
  using (can_access_scope('own', created_by, assigned_to) or can_access_scope('team', null, null))
  with check (can_access_scope('own', created_by, assigned_to) or can_access_scope('team', null, null));
create policy "Role scoped delete deals" on public.deals
  for delete to authenticated using (
    can_access_scope('own', created_by, assigned_to)
    or can_access_scope('team', null, null)
  );

-- ═══════════════════════════════════════════════════════════════
-- 8. QUOTES  (created_by text — default auth.uid()::text above)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.quotes;
drop policy if exists "Team members can view quotes" on public.quotes;
drop policy if exists "Users can insert quotes" on public.quotes;
drop policy if exists "Team members can update quotes" on public.quotes;
drop policy if exists "Team members can delete quotes" on public.quotes;

create policy "Role scoped view quotes" on public.quotes
  for select to authenticated using (
    team_role() = 'viewer'
    or can_access_scope('own', created_by, null)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped insert quotes" on public.quotes
  for insert to authenticated with check (
    can_access_scope('own', created_by, null)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped update quotes" on public.quotes
  for update to authenticated
  using (can_access_scope('own', created_by, null) or can_access_scope('team', null, null))
  with check (can_access_scope('own', created_by, null) or can_access_scope('team', null, null));
create policy "Role scoped delete quotes" on public.quotes
  for delete to authenticated using (
    can_access_scope('own', created_by, null)
    or can_access_scope('team', null, null)
  );

-- ═══════════════════════════════════════════════════════════════
-- 9. CAMPAIGNS – EMAIL SEQUENCES  (created_by text — set by
--    campaign.service from the session user)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.email_sequences;
drop policy if exists "Team members can view email sequences" on public.email_sequences;
drop policy if exists "Users can insert email sequences" on public.email_sequences;
drop policy if exists "Team members can update email sequences" on public.email_sequences;
drop policy if exists "Team members can delete email sequences" on public.email_sequences;

create policy "Role scoped view email sequences" on public.email_sequences
  for select to authenticated using (
    team_role() = 'viewer'
    or can_access_scope('own', created_by, null)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped insert email sequences" on public.email_sequences
  for insert to authenticated with check (
    can_access_scope('own', created_by, null)
    or can_access_scope('team', null, null)
  );
create policy "Role scoped update email sequences" on public.email_sequences
  for update to authenticated
  using (can_access_scope('own', created_by, null) or can_access_scope('team', null, null))
  with check (can_access_scope('own', created_by, null) or can_access_scope('team', null, null));
create policy "Role scoped delete email sequences" on public.email_sequences
  for delete to authenticated using (
    can_access_scope('own', created_by, null)
    or can_access_scope('team', null, null)
  );

-- ═══════════════════════════════════════════════════════════════
-- 10. CAMPAIGN EMAILS (children of email_sequences — agent own scope
--     is enforced through the owning sequence's created_by)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.campaign_emails;
drop policy if exists "Team members can view campaign emails" on public.campaign_emails;
drop policy if exists "Team members can insert campaign emails" on public.campaign_emails;
drop policy if exists "Team members can update campaign emails" on public.campaign_emails;
drop policy if exists "Team members can delete campaign emails" on public.campaign_emails;

create policy "Role scoped view campaign emails" on public.campaign_emails
  for select to authenticated using (
    team_role() = 'viewer'
    or can_access_scope('team', null, null)
    or exists (
      select 1 from public.email_sequences s
      where s.id = campaign_emails.sequence_id
        and s.created_by = auth.uid()::text
    )
  );
create policy "Role scoped insert campaign emails" on public.campaign_emails
  for insert to authenticated with check (
    can_access_scope('team', null, null)
    or exists (
      select 1 from public.email_sequences s
      where s.id = campaign_emails.sequence_id
        and s.created_by = auth.uid()::text
    )
  );
create policy "Role scoped update campaign emails" on public.campaign_emails
  for update to authenticated
  using (
    can_access_scope('team', null, null)
    or exists (
      select 1 from public.email_sequences s
      where s.id = campaign_emails.sequence_id
        and s.created_by = auth.uid()::text
    )
  )
  with check (
    can_access_scope('team', null, null)
    or exists (
      select 1 from public.email_sequences s
      where s.id = campaign_emails.sequence_id
        and s.created_by = auth.uid()::text
    )
  );
create policy "Role scoped delete campaign emails" on public.campaign_emails
  for delete to authenticated using (
    can_access_scope('team', null, null)
    or exists (
      select 1 from public.email_sequences s
      where s.id = campaign_emails.sequence_id
        and s.created_by = auth.uid()::text
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 11. TEAMS – admin-scoped mutation (FIX: update was created_by-scoped,
--     which demoted a second admin could still use and promoted admins
--     could not; delete was missing entirely)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Users can view teams they belong to" on public.teams;
create policy "Users can view teams they belong to" on public.teams
  for select to authenticated using (
    is_team_member(id)
    or created_by::text = auth.uid()::text
  );

drop policy if exists "Authenticated users can create teams" on public.teams;
create policy "Authenticated users can create teams" on public.teams
  for insert to authenticated with check (true);

drop policy if exists "Team admins can update their team" on public.teams;
create policy "Team admins can update their team" on public.teams
  for update to authenticated
  using (is_team_admin(id))
  with check (is_team_admin(id));

drop policy if exists "Team admins can delete their team" on public.teams;
create policy "Team admins can delete their team" on public.teams
  for delete to authenticated using (is_team_admin(id));

-- ═══════════════════════════════════════════════════════════════
-- 12. TEAM MEMBERS / TEAM INVITATIONS
--     Already correct from 00001_initial_schema.sql (all roles read
--     roster/invitations, admin-only mutation via is_team_admin) —
--     left untouched. rate_limits stays service-role-only.
-- ═══════════════════════════════════════════════════════════════

-- Done. The blanket is_any_team_member() CRUD policies on the matrix
-- entity tables (leads, companies, contacts, tasks, meetings, deals,
-- quotes, email_sequences, campaign_emails) are replaced by
-- role-scoped policies.
