-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Wave 5: Automation Rules
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.automation_rules (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  description  text        not null default '',
  trigger_event text       not null check (trigger_event in (
    'lead.created', 'lead.updated', 'lead.status_changed',
    'contact.created', 'contact.updated',
    'company.created', 'company.updated',
    'task.created', 'task.completed', 'task.overdue',
    'meeting.created', 'meeting.completed',
    'deal.created', 'deal.stage_changed'
  )),
  conditions   jsonb       not null default '[]'::jsonb,
  actions      jsonb       not null default '[]'::jsonb,
  enabled      boolean     not null default true,
  created_by   text        not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_automation_rules_trigger on public.automation_rules(trigger_event);
create index if not exists idx_automation_rules_enabled on public.automation_rules(enabled);
create index if not exists idx_automation_rules_created_by on public.automation_rules(created_by);

drop trigger if exists trigger_automation_rules_updated_at on public.automation_rules;
create trigger trigger_automation_rules_updated_at
  before update on public.automation_rules
  for each row execute function handle_updated_at();

alter table public.automation_rules enable row level security;

drop policy if exists "Users can view rules they created" on public.automation_rules;
create policy "Users can view rules they created" on public.automation_rules
  for select to authenticated using (created_by = auth.uid()::text);

drop policy if exists "Users can create rules" on public.automation_rules;
create policy "Users can create rules" on public.automation_rules
  for insert to authenticated with check (created_by = auth.uid()::text);

drop policy if exists "Users can update own rules" on public.automation_rules;
create policy "Users can update own rules" on public.automation_rules
  for update to authenticated using (created_by = auth.uid()::text);

drop policy if exists "Users can delete own rules" on public.automation_rules;
create policy "Users can delete own rules" on public.automation_rules
  for delete to authenticated using (created_by = auth.uid()::text);
