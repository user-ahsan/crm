-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Wave 9: Schema Alignment (schema/types reconciliation)
-- Created by the schema & types alignment fix agent (F2).
--
-- Adds tables that services query but no migration created:
--   profiles, invoices, invoice_items, invoice_templates, webhook_events
-- Widens CHECK constraints that services already write against:
--   email_history.status  -> draft, pending, queued, sent, failed
--   sms_logs.status       -> sent, queued, delivered, failed
--   campaign_recipients.status -> pending, processing, sent, failed, opened
-- Adds missing columns / constraints required by services:
--   leads.deleted_at (lead.service filters .is('deleted_at', null))
--   companies.tags (company.service maps row.tags)
--   unique(team_id, email) on team_invitations (duplicate-invite guard)
--   unique(sequence_id, recipient_email) on campaign_recipients
--     (scheduler comment: "TOCTOU mitigated by DB unique constraint")
--
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ─────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
-- 1. PROFILES (queried by services/lead.service.ts:129,197 —
--    supabase.from('profiles').select('id').eq('id', assignedTo))
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id         uuid         primary key references auth.users(id) on delete cascade,
  email      text         null,
  full_name  text         null,
  avatar_url text         null,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now()
);

create index if not exists idx_profiles_email on public.profiles(email);

alter table public.profiles enable row level security;
drop policy if exists "Team members can view profiles" on public.profiles;
create policy "Team members can view profiles" on public.profiles
  for select to authenticated using (is_any_team_member());
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated using (id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- 2. INVOICES + INVOICE_ITEMS
--    The invoice feature was fully implemented in code (service,
--    hooks, routes, mock data) with NO database table. id is text
--    (not uuid) to stay compatible with the string ids used by the
--    mock seed data (data/invoices.ts uses inv-001..inv-005) and
--    with the app-level create path which never supplies an id.
--    created_by defaults to the auth user because
--    invoiceService.create() does not pass it (same pattern as the
--    quotes feature, but with a safe default so inserts succeed).
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.invoices (
  id              text         primary key default gen_random_uuid()::text,
  quote_id        uuid         null references public.quotes(id) on delete set null,
  invoice_number  text         not null,
  title           text         not null default '',
  deal_id         uuid         null references public.deals(id) on delete set null,
  lead_id         uuid         null references public.leads(id) on delete set null,
  contact_id      uuid         null references public.contacts(id) on delete set null,
  company_id      uuid         null references public.companies(id) on delete set null,
  status          text         not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')),
  subtotal        numeric      not null default 0 check (subtotal >= 0),
  discount        numeric      not null default 0 check (discount >= 0),
  tax_rate        numeric      not null default 0 check (tax_rate >= 0),
  tax             numeric      not null default 0 check (tax >= 0),
  total           numeric      not null default 0 check (total >= 0),
  notes           text         not null default '',
  due_date        timestamptz  null,
  paid_at         timestamptz  null,
  payment_terms   text         null,
  company_name    text         null,
  company_address text         null,
  company_email   text         null,
  company_phone   text         null,
  created_by      text         not null default auth.uid()::text,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

-- Billing identity must be unique (case-insensitive so INV-2026-0001 == inv-2026-0001).
-- NOTE: invoiceService.getNextInvoiceNumber() is random (4 digits) — the service
-- must be fixed to sequential/checked generation now that the DB enforces this.
create unique index if not exists idx_invoices_number on public.invoices(lower(invoice_number));
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);
create index if not exists idx_invoices_quote on public.invoices(quote_id);
create index if not exists idx_invoices_company on public.invoices(company_id);

drop trigger if exists trigger_invoices_updated_at on public.invoices;
create trigger trigger_invoices_updated_at before update on public.invoices
  for each row execute function handle_updated_at();

alter table public.invoices enable row level security;
drop policy if exists "Team members can view invoices" on public.invoices;
create policy "Team members can view invoices" on public.invoices
  for select to authenticated using (is_any_team_member());
drop policy if exists "Users can insert invoices" on public.invoices;
create policy "Users can insert invoices" on public.invoices
  for insert to authenticated with check (created_by = auth.uid()::text);
drop policy if exists "Team members can update invoices" on public.invoices;
create policy "Team members can update invoices" on public.invoices
  for update to authenticated using (is_any_team_member());
drop policy if exists "Team members can delete invoices" on public.invoices;
create policy "Team members can delete invoices" on public.invoices
  for delete to authenticated using (is_any_team_member());

create table if not exists public.invoice_items (
  id          text     primary key default gen_random_uuid()::text,
  invoice_id  text     not null references public.invoices(id) on delete cascade,
  description text     not null,
  quantity    numeric  not null default 1 check (quantity > 0),
  unit_price  numeric  not null default 0 check (unit_price >= 0),
  total       numeric  not null default 0,
  sort_order  integer  not null default 0
);

create index if not exists idx_invoice_items_invoice on public.invoice_items(invoice_id);

alter table public.invoice_items enable row level security;
drop policy if exists "Team members can view invoice items" on public.invoice_items;
create policy "Team members can view invoice items" on public.invoice_items
  for select to authenticated using (is_any_team_member());
drop policy if exists "Team members can insert invoice items" on public.invoice_items;
create policy "Team members can insert invoice items" on public.invoice_items
  for insert to authenticated with check (is_any_team_member());
drop policy if exists "Team members can update invoice items" on public.invoice_items;
create policy "Team members can update invoice items" on public.invoice_items
  for update to authenticated using (is_any_team_member());
drop policy if exists "Team members can delete invoice items" on public.invoice_items;
create policy "Team members can delete invoice items" on public.invoice_items
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 3. INVOICE_TEMPLATES (settings > invoice templates CRUD)
--    Snake_case columns; the settings page currently sends camelCase
--    keys — that is an app-layer fix (see PATTERN-schema.md).
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.invoice_templates (
  id              text         primary key default gen_random_uuid()::text,
  name            text         not null,
  is_default      boolean      not null default false,
  logo_url        text         null,
  primary_color   text         not null default '#1e293b',
  accent_color    text         not null default '#3b82f6',
  company_name    text         not null default '',
  company_address text         not null default '',
  company_email   text         not null default '',
  company_phone   text         not null default '',
  footer_text     text         not null default '',
  payment_terms   text         null,
  created_by      text         not null default auth.uid()::text,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

drop trigger if exists trigger_invoice_templates_updated_at on public.invoice_templates;
create trigger trigger_invoice_templates_updated_at before update on public.invoice_templates
  for each row execute function handle_updated_at();

alter table public.invoice_templates enable row level security;
drop policy if exists "Team members can view invoice templates" on public.invoice_templates;
create policy "Team members can view invoice templates" on public.invoice_templates
  for select to authenticated using (is_any_team_member());
drop policy if exists "Users can insert invoice templates" on public.invoice_templates;
create policy "Users can insert invoice templates" on public.invoice_templates
  for insert to authenticated with check (created_by = auth.uid()::text);
drop policy if exists "Team members can update invoice templates" on public.invoice_templates;
create policy "Team members can update invoice templates" on public.invoice_templates
  for update to authenticated using (is_any_team_member());
drop policy if exists "Team members can delete invoice templates" on public.invoice_templates;
create policy "Team members can delete invoice templates" on public.invoice_templates
  for delete to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 4. WEBHOOK_EVENTS (n8n ingest persistence — app/api/webhook/n8n/route.ts:296
--    inserts { source, event_type, payload, status, created_at }).
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.webhook_events (
  id            uuid         primary key default gen_random_uuid(),
  source        text         not null default 'n8n',
  event_type    text         not null,
  payload       jsonb        not null default '{}'::jsonb,
  status        text         not null default 'received' check (status in ('received', 'processed', 'failed')),
  error_message text         null,
  created_at    timestamptz  not null default now()
);

create index if not exists idx_webhook_events_created on public.webhook_events(created_at desc);
create index if not exists idx_webhook_events_event_type on public.webhook_events(event_type);
create index if not exists idx_webhook_events_status on public.webhook_events(status);

alter table public.webhook_events enable row level security;
-- Written by the server-side client (service_role) in the n8n route; RLS allows
-- team members to view ingested events, and the service-role path bypasses RLS
-- for inserts.
drop policy if exists "Team members can view webhook events" on public.webhook_events;
create policy "Team members can view webhook events" on public.webhook_events
  for select to authenticated using (is_any_team_member());

-- ═══════════════════════════════════════════════════════════════
-- 5. CHECK-CONSTRAINT WIDENING (services already write these values)
-- ═══════════════════════════════════════════════════════════════

-- 5a. email_history.status: communication.service inserts 'pending' (line 261)
--     and updates to 'queued'/'failed'/'sent' (lines 278-321); saveDraft
--     inserts 'draft'. The 00004 constraint only allowed draft/sent/failed.
alter table public.email_history drop constraint if exists email_history_status_check;
alter table public.email_history add constraint email_history_status_check
  check (status in ('draft', 'pending', 'queued', 'sent', 'failed'));

-- 5b. sms_logs.status: sms.service.send() inserts 'queued' when Twilio is not
--     configured (line 66) and 'sent' otherwise. The 00007 constraint only
--     allowed sent/delivered/failed.
alter table public.sms_logs drop constraint if exists sms_logs_status_check;
alter table public.sms_logs add constraint sms_logs_status_check
  check (status in ('sent', 'queued', 'delivered', 'failed'));

-- 5c. campaign_recipients.status: campaign-scheduler claims batches with
--     status 'processing' (line 190). The 20260726 constraint did not allow it.
alter table public.campaign_recipients drop constraint if exists campaign_recipients_status_check;
alter table public.campaign_recipients add constraint campaign_recipients_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'opened'));

-- ═══════════════════════════════════════════════════════════════
-- 6. MISSING COLUMNS
-- ═══════════════════════════════════════════════════════════════

-- 6a. leads.deleted_at — lead.service.getPipelineStats filters
--     .is('deleted_at', null) (services/lead.service.ts:409); soft-delete
--     support per the leads feature.
alter table public.leads add column if not exists deleted_at timestamptz null;
create index if not exists idx_leads_deleted_at on public.leads(deleted_at);

-- 6b. companies.tags — company.service maps row.tags and useCompanies reads
--     data.tags, but the 00001 companies table had no tags column. Added to
--     match leads/contacts/deals which all carry tags text[].
alter table public.companies add column if not exists tags text[] not null default '{}';
create index if not exists idx_companies_tags on public.companies using gin(tags);

-- ═══════════════════════════════════════════════════════════════
-- 7. UNIQUE CONSTRAINTS
-- ═══════════════════════════════════════════════════════════════

-- 7a. team_invitations(team_id, email) — duplicate-invitation guard;
--     team.service.ts:168-170 handles Postgres error 23505 on insert.
create unique index if not exists idx_team_invitations_team_email
  on public.team_invitations(team_id, email);

-- 7b. campaign_recipients(sequence_id, recipient_email) — prevents double
--     activation of a sequence for the same address; the scheduler comment
--     ("TOCTOU mitigated by DB unique constraint") requires it.
create unique index if not exists idx_campaign_recipients_sequence_email
  on public.campaign_recipients(sequence_id, recipient_email);

-- ─────────────────────────────────────────────────────────────
-- Schema alignment complete. Tables added: profiles, invoices,
-- invoice_items, invoice_templates, webhook_events. Constraints
-- widened, columns added, unique indexes created.
-- ─────────────────────────────────────────────────────────────
