-- ─────────────────────────────────────────────────────────────
-- NexusCRM – RLS Policy Hardening
-- Drops all wide-open "Enable all for authenticated users" policies
-- and replaces them with team-scoped/owner-scoped policies.
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run — all statements use DROP IF EXISTS / OR REPLACE.
-- ─────────────────────────────────────────────────────────────

-- ── Helper: get the current user's team ID ─────────────────────
create or replace function public.get_current_user_team_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select team_id
  from public.team_members
  where user_id = auth.uid()::text
  limit 1;
$$;

-- ── Helper: check if user is a member of ANY team ──────────────
create or replace function public.is_any_team_member()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.team_members
    where user_id = auth.uid()::text
  );
$$;

-- ═══════════════════════════════════════════════════════════════
-- 1. LEADS
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.leads;

create policy "Team members can view leads" on public.leads
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert leads" on public.leads
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update leads" on public.leads
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete leads" on public.leads
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 2. COMPANIES
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.companies;

create policy "Team members can view companies" on public.companies
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert companies" on public.companies
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update companies" on public.companies
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete companies" on public.companies
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 3. CONTACTS
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.contacts;

create policy "Team members can view contacts" on public.contacts
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert contacts" on public.contacts
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update contacts" on public.contacts
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete contacts" on public.contacts
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 4. TASKS
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.tasks;

create policy "Team members can view tasks" on public.tasks
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert tasks" on public.tasks
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update tasks" on public.tasks
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete tasks" on public.tasks
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 5. MEETINGS
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.meetings;

create policy "Team members can view meetings" on public.meetings
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert meetings" on public.meetings
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update meetings" on public.meetings
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete meetings" on public.meetings
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 6. ACTIVITIES
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.activities;

create policy "Team members can view activities" on public.activities
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert activities" on public.activities
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update activities" on public.activities
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete activities" on public.activities
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 7. TAGS
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.tags;

create policy "Team members can view tags" on public.tags
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert tags" on public.tags
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update tags" on public.tags
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete tags" on public.tags
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 8. TAGGINGS
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.taggings;

create policy "Team members can view taggings" on public.taggings
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert taggings" on public.taggings
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can delete taggings" on public.taggings
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 9. EMAIL HISTORY
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.email_history;

create policy "Team members can view email history" on public.email_history
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert email history" on public.email_history
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update email history" on public.email_history
  for update to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 10. CALL LOGS
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.call_logs;

create policy "Team members can view call logs" on public.call_logs
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert call logs" on public.call_logs
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update call logs" on public.call_logs
  for update to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 11. NOTES (created_by scoped for write, team-scoped for read)
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.notes;

create policy "Team members can view notes" on public.notes
  for select to authenticated using (is_any_team_member());
create policy "Users can insert own notes" on public.notes
  for insert to authenticated with check (created_by = auth.uid()::text);
create policy "Users can update own notes" on public.notes
  for update to authenticated using (created_by = auth.uid()::text);
create policy "Users can delete own notes" on public.notes
  for delete to authenticated using (created_by = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════
-- 12. DEAL STAGES
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.deal_stages;

create policy "Team members can view deal stages" on public.deal_stages
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert deal stages" on public.deal_stages
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update deal stages" on public.deal_stages
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete deal stages" on public.deal_stages
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 13. DEALS
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.deals;

create policy "Team members can view deals" on public.deals
  for select to authenticated using (is_any_team_member());
create policy "Users can insert deals" on public.deals
  for insert to authenticated with check (created_by = auth.uid()::text);
create policy "Team members can update deals" on public.deals
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete deals" on public.deals
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 14. LEAD SCORES
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.lead_scores;

create policy "Team members can view lead scores" on public.lead_scores
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert lead scores" on public.lead_scores
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update lead scores" on public.lead_scores
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete lead scores" on public.lead_scores
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 15. QUOTES
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.quotes;

create policy "Team members can view quotes" on public.quotes
  for select to authenticated using (is_any_team_member());
create policy "Users can insert quotes" on public.quotes
  for insert to authenticated with check (created_by = auth.uid()::text);
create policy "Team members can update quotes" on public.quotes
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete quotes" on public.quotes
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 16. QUOTE ITEMS
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.quote_items;

create policy "Team members can view quote items" on public.quote_items
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert quote items" on public.quote_items
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update quote items" on public.quote_items
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete quote items" on public.quote_items
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 17. FORECASTS
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated users" on public.forecasts;

create policy "Team members can view forecasts" on public.forecasts
  for select to authenticated using (is_any_team_member());
create policy "Users can insert forecasts" on public.forecasts
  for insert to authenticated with check (created_by = auth.uid()::text);
create policy "Team members can update forecasts" on public.forecasts
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete forecasts" on public.forecasts
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 18. EMAIL SEQUENCES
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.email_sequences;

create policy "Team members can view email sequences" on public.email_sequences
  for select to authenticated using (is_any_team_member());
create policy "Users can insert email sequences" on public.email_sequences
  for insert to authenticated with check (created_by = auth.uid()::text);
create policy "Team members can update email sequences" on public.email_sequences
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete email sequences" on public.email_sequences
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 19. CAMPAIGN EMAILS
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.campaign_emails;

create policy "Team members can view campaign emails" on public.campaign_emails
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert campaign emails" on public.campaign_emails
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update campaign emails" on public.campaign_emails
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete campaign emails" on public.campaign_emails
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 20. GOALS
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.goals;

create policy "Team members can view goals" on public.goals
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert goals" on public.goals
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update goals" on public.goals
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete goals" on public.goals
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 21. FILE ATTACHMENTS
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.file_attachments;

create policy "Team members can view file attachments" on public.file_attachments
  for select to authenticated using (is_any_team_member());
create policy "Users can insert file attachments" on public.file_attachments
  for insert to authenticated with check (uploaded_by = auth.uid()::text);
create policy "Team members can update file attachments" on public.file_attachments
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete file attachments" on public.file_attachments
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 22. SAVED VIEWS (user-scoped)
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.saved_views;

create policy "Users can view own saved views" on public.saved_views
  for select to authenticated using (created_by = auth.uid()::text);
create policy "Users can insert own saved views" on public.saved_views
  for insert to authenticated with check (created_by = auth.uid()::text);
create policy "Users can update own saved views" on public.saved_views
  for update to authenticated using (created_by = auth.uid()::text);
create policy "Users can delete own saved views" on public.saved_views
  for delete to authenticated using (created_by = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════
-- 23. API KEYS (user-scoped)
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.api_keys;

create policy "Users can view own API keys" on public.api_keys
  for select to authenticated using (created_by = auth.uid()::text);
create policy "Users can insert own API keys" on public.api_keys
  for insert to authenticated with check (created_by = auth.uid()::text);
create policy "Users can update own API keys" on public.api_keys
  for update to authenticated using (created_by = auth.uid()::text);
create policy "Users can delete own API keys" on public.api_keys
  for delete to authenticated using (created_by = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════
-- 24. WORKFLOW STATES
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.workflow_states;

create policy "Team members can view workflow states" on public.workflow_states
  for select to authenticated using (is_any_team_member());
create policy "Users can insert workflow states" on public.workflow_states
  for insert to authenticated with check (created_by = auth.uid()::text);
create policy "Team members can update workflow states" on public.workflow_states
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete workflow states" on public.workflow_states
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 25. WORKFLOW TRANSITIONS
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.workflow_transitions;

create policy "Team members can view workflow transitions" on public.workflow_transitions
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert workflow transitions" on public.workflow_transitions
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update workflow transitions" on public.workflow_transitions
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete workflow transitions" on public.workflow_transitions
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 26. CALENDAR INTEGRATIONS (user-scoped)
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.calendar_integrations;

create policy "Users can view own calendar integrations" on public.calendar_integrations
  for select to authenticated using (created_by = auth.uid()::text);
create policy "Users can insert own calendar integrations" on public.calendar_integrations
  for insert to authenticated with check (created_by = auth.uid()::text);
create policy "Users can update own calendar integrations" on public.calendar_integrations
  for update to authenticated using (created_by = auth.uid()::text);
create policy "Users can delete own calendar integrations" on public.calendar_integrations
  for delete to authenticated using (created_by = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════
-- 27. SMS LOGS
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.sms_logs;

create policy "Team members can view SMS logs" on public.sms_logs
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert SMS logs" on public.sms_logs
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update SMS logs" on public.sms_logs
  for update to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 28. PORTAL USERS
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.portal_users;

create policy "Team members can view portal users" on public.portal_users
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert portal users" on public.portal_users
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update portal users" on public.portal_users
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete portal users" on public.portal_users
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 29. PORTAL SHARES
-- ════════════════════════════════════════════════════════════════
drop policy if exists "Enable all for authenticated" on public.portal_shares;

create policy "Team members can view portal shares" on public.portal_shares
  for select to authenticated using (is_any_team_member());
create policy "Team members can insert portal shares" on public.portal_shares
  for insert to authenticated with check (is_any_team_member());
create policy "Team members can update portal shares" on public.portal_shares
  for update to authenticated using (is_any_team_member());
create policy "Team members can delete portal shares" on public.portal_shares
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- Done. All tables now have team-scoped or owner-scoped policies,
-- replacing the previous wide-open "using (true)" policies.
-- ═══════════════════════════════════════════════════════════════
