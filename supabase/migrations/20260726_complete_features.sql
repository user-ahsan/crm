-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Wave 8: Complete Features
-- Tables: webhook_configs, webhook_deliveries, campaign_recipients,
--         notification_preferences
-- Alterations: email_history + sms_logs new columns
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ─────────────────────────────────────────────────────────────

-- 1. WEBHOOK CONFIGS
create table if not exists public.webhook_configs (
  id         uuid         primary key default gen_random_uuid(),
  name       text         not null,
  url        text         not null,
  secret     text         null,
  events     text[]       null,
  active     boolean      not null default true,
  created_by uuid         not null references auth.users(id),
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now()
);

alter table public.webhook_configs enable row level security;
drop policy if exists "Users can create their own webhook configs" on public.webhook_configs;
create policy "Users can create their own webhook configs" on public.webhook_configs
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Users can view their own webhook configs" on public.webhook_configs;
create policy "Users can view their own webhook configs" on public.webhook_configs
  for select to authenticated using (created_by = auth.uid());
drop policy if exists "Users can update their own webhook configs" on public.webhook_configs;
create policy "Users can update their own webhook configs" on public.webhook_configs
  for update to authenticated using (created_by = auth.uid());
drop policy if exists "Users can delete their own webhook configs" on public.webhook_configs;
create policy "Users can delete their own webhook configs" on public.webhook_configs
  for delete to authenticated using (created_by = auth.uid());

-- 2. WEBHOOK DELIVERIES
create table if not exists public.webhook_deliveries (
  id              uuid         primary key default gen_random_uuid(),
  webhook_config_id uuid       null references public.webhook_configs(id),
  event           text         not null,
  url             text         not null,
  status          text         not null check (status in ('success', 'failed', 'pending')),
  request_body    jsonb        not null default '{}'::jsonb,
  response_status integer      null,
  response_body   text         null,
  error_message   text         null,
  duration_ms     integer      null,
  created_at      timestamptz  not null default now()
);

create index if not exists idx_webhook_deliveries_config on public.webhook_deliveries(webhook_config_id);
create index if not exists idx_webhook_deliveries_created on public.webhook_deliveries(created_at desc);

alter table public.webhook_deliveries enable row level security;
drop policy if exists "Users can view deliveries for their webhooks" on public.webhook_deliveries;
create policy "Users can view deliveries for their webhooks" on public.webhook_deliveries
  for select to authenticated using (
    webhook_config_id is null or
    exists (select 1 from public.webhook_configs where id = webhook_deliveries.webhook_config_id and created_by = auth.uid())
  );

-- 3. CAMPAIGN RECIPIENTS
create table if not exists public.campaign_recipients (
  id                  uuid         primary key default gen_random_uuid(),
  sequence_id         uuid         not null references public.email_sequences(id) on delete cascade,
  campaign_email_id   uuid         null references public.campaign_emails(id) on delete cascade,
  recipient_type      text         not null check (recipient_type in ('lead', 'contact')),
  recipient_id        uuid         not null,
  recipient_email     text         not null,
  status              text         not null default 'pending' check (status in ('pending', 'sent', 'failed', 'opened')),
  provider_message_id text         null,
  scheduled_send_at   timestamptz  null,
  sent_at             timestamptz  null,
  error_message       text         null,
  created_at          timestamptz  not null default now()
);

create index if not exists idx_campaign_recipients_sequence on public.campaign_recipients(sequence_id);
create index if not exists idx_campaign_recipients_status on public.campaign_recipients(status);
create index if not exists idx_campaign_recipients_scheduled on public.campaign_recipients(scheduled_send_at) where status = 'pending';

alter table public.campaign_recipients enable row level security;
drop policy if exists "Users can view recipients for their sequences" on public.campaign_recipients;
create policy "Users can view recipients for their sequences" on public.campaign_recipients
  for select to authenticated using (
    exists (select 1 from public.email_sequences where id = campaign_recipients.sequence_id and created_by = auth.uid())
  );
drop policy if exists "Users can manage recipients for their sequences" on public.campaign_recipients;
create policy "Users can manage recipients for their sequences" on public.campaign_recipients
  for insert to authenticated with check (
    exists (select 1 from public.email_sequences where id = campaign_recipients.sequence_id and created_by = auth.uid())
  );
drop policy if exists "Users can update recipients for their sequences" on public.campaign_recipients;
create policy "Users can update recipients for their sequences" on public.campaign_recipients
  for update to authenticated using (
    exists (select 1 from public.email_sequences where id = campaign_recipients.sequence_id and created_by = auth.uid())
  );

-- 4. NOTIFICATION PREFERENCES
create table if not exists public.notification_preferences (
  id                  uuid         primary key default gen_random_uuid(),
  user_id             uuid         not null references auth.users(id) unique,
  email_notifications boolean      not null default true,
  push_notifications  boolean      not null default true,
  realtime_enabled    boolean      not null default true,
  notify_on           text[]       not null default '{"lead_created","task_due","meeting_scheduled","deal_won"}',
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

alter table public.notification_preferences enable row level security;
drop policy if exists "Users can create their own notification preferences" on public.notification_preferences;
create policy "Users can create their own notification preferences" on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users can view their own notification preferences" on public.notification_preferences;
create policy "Users can view their own notification preferences" on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users can update their own notification preferences" on public.notification_preferences;
create policy "Users can update their own notification preferences" on public.notification_preferences
  for update to authenticated using (user_id = auth.uid());
drop policy if exists "Users can delete their own notification preferences" on public.notification_preferences;
create policy "Users can delete their own notification preferences" on public.notification_preferences
  for delete to authenticated using (user_id = auth.uid());

-- 5. ADD PROVIDER FIELDS TO EMAIL HISTORY
alter table public.email_history add column if not exists provider_message_id text;
alter table public.email_history add column if not exists error_message text;

-- 6. ADD PROVIDER FIELDS TO SMS LOGS
alter table public.sms_logs add column if not exists provider_message_id text;
alter table public.sms_logs add column if not exists error_message text;

-- 7. INDEXES (partial index already created above with the table)
-- Partial index for scheduled pending deliveries already created above.

-- 8. TRIGGERS FOR UPDATED_AT
drop trigger if exists handle_webhook_configs_updated_at on public.webhook_configs;
create trigger handle_webhook_configs_updated_at before update on public.webhook_configs
  for each row execute function handle_updated_at();

drop trigger if exists handle_notification_preferences_updated_at on public.notification_preferences;
create trigger handle_notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function handle_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Performance indexes, constraints, and type fixes
-- ─────────────────────────────────────────────────────────────

-- 9. GIN INDEXES FOR ARRAY COLUMNS
create index if not exists idx_leads_tags on public.leads using gin(tags);
create index if not exists idx_contacts_lead_ids on public.contacts using gin(lead_ids);
create index if not exists idx_companies_contact_ids on public.companies using gin(contact_ids);
create index if not exists idx_companies_lead_ids on public.companies using gin(lead_ids);

-- 10. COMPOSITE INDEXES
create index if not exists idx_leads_status_assigned on public.leads(status, assigned_to);
create index if not exists idx_tasks_status_due on public.tasks(status, due_date);
create index if not exists idx_deals_stage_assigned on public.deals(stage_id, assigned_to);
create index if not exists idx_quotes_status_created on public.quotes(status, created_by);

-- 11. MISSING SINGLE-COLUMN INDEXES
create index if not exists idx_email_history_status on public.email_history(status);
create index if not exists idx_call_logs_direction on public.call_logs(direction);
create index if not exists idx_workflow_states_entity on public.workflow_states(entity_type);

-- 12. FIX file_attachments.size_bytes FROM integer TO bigint
alter table public.file_attachments alter column size_bytes type bigint using size_bytes::bigint;

-- 13. ADD ON DELETE CASCADE TO webhook_deliveries
alter table public.webhook_deliveries drop constraint if exists webhook_deliveries_webhook_config_id_fkey;
alter table public.webhook_deliveries add constraint webhook_deliveries_webhook_config_id_fkey
  foreign key (webhook_config_id) references public.webhook_configs(id) on delete set null;

-- 14. UNIQUE CONSTRAINTS
create unique index if not exists idx_companies_lower_name on public.companies(lower(name));
create unique index if not exists idx_leads_unique_email on public.leads(lower(email)) where email is not null;
create unique index if not exists idx_contacts_unique_email on public.contacts(lower(email)) where email is not null;

-- 15. ADD 'deal' TO tasks.related_to_type CHECK CONSTRAINT
alter table public.tasks drop constraint if exists tasks_related_to_type_check;
alter table public.tasks add constraint tasks_related_to_type_check
  check (related_to_type in ('lead', 'contact', 'company', 'deal'));

-- 16. ADD updated_at TRIGGER FOR lead_scores
drop trigger if exists trigger_lead_scores_updated_at on public.lead_scores;
create trigger trigger_lead_scores_updated_at
  before update on public.lead_scores
  for each row execute function handle_updated_at();
