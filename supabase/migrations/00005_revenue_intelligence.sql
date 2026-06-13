-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Wave 4: Revenue Intelligence
-- Tables: deals, deal_stages, lead_scores, quotes, quote_items, forecasts
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ─────────────────────────────────────────────────────────────

-- 1. DEAL STAGES (pipeline configuration)
create table if not exists public.deal_stages (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  color      text        not null default '#6366f1',
  probability integer   not null default 0 check (probability >= 0 and probability <= 100),
  sort_order integer    not null default 0,
  created_at timestamptz not null default now()
);

alter table public.deal_stages enable row level security;
drop policy if exists "Enable all for authenticated users" on public.deal_stages;
create policy "Enable all for authenticated users" on public.deal_stages for all to authenticated using (true) with check (true);

-- 2. DEALS (revenue tracking)
create table if not exists public.deals (
  id             uuid        primary key default gen_random_uuid(),
  title          text        not null,
  description    text        not null default '',
  value          numeric     not null default 0 check (value >= 0),
  currency       text        not null default 'USD',
  stage_id       uuid        null references public.deal_stages(id) on delete set null,
  lead_id        uuid        null references public.leads(id) on delete set null,
  contact_id     uuid        null references public.contacts(id) on delete set null,
  company_id     uuid        null references public.companies(id) on delete set null,
  assigned_to    text        null,
  close_date     date        null,
  win_loss_reason text      not null default '',
  tags           text[]      not null default '{}',
  created_by     text        not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_deals_stage on public.deals(stage_id);
create index if not exists idx_deals_assigned on public.deals(assigned_to);
create index if not exists idx_deals_lead on public.deals(lead_id);
create index if not exists idx_deals_company on public.deals(company_id);

drop trigger if exists trigger_deals_updated_at on public.deals;
create trigger trigger_deals_updated_at before update on public.deals for each row execute function handle_updated_at();

alter table public.deals enable row level security;
drop policy if exists "Enable all for authenticated users" on public.deals;
create policy "Enable all for authenticated users" on public.deals for all to authenticated using (true) with check (true);

-- 3. LEAD SCORES
create table if not exists public.lead_scores (
  id         uuid        primary key default gen_random_uuid(),
  lead_id    uuid        not null references public.leads(id) on delete cascade unique,
  score      integer     not null default 0 check (score >= 0 and score <= 100),
  factors    jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.lead_scores enable row level security;
drop policy if exists "Enable all for authenticated users" on public.lead_scores;
create policy "Enable all for authenticated users" on public.lead_scores for all to authenticated using (true) with check (true);

-- 4. QUOTES
create table if not exists public.quotes (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  deal_id      uuid        null references public.deals(id) on delete set null,
  lead_id      uuid        null references public.leads(id) on delete set null,
  contact_id   uuid        null references public.contacts(id) on delete set null,
  company_id   uuid        null references public.companies(id) on delete set null,
  status       text        not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  subtotal     numeric     not null default 0,
  discount     numeric     not null default 0,
  total        numeric     not null default 0,
  notes        text        not null default '',
  valid_until  date        null,
  created_by   text        not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_quotes_deal on public.quotes(deal_id);

drop trigger if exists trigger_quotes_updated_at on public.quotes;
create trigger trigger_quotes_updated_at before update on public.quotes for each row execute function handle_updated_at();

alter table public.quotes enable row level security;
drop policy if exists "Enable all for authenticated users" on public.quotes;
create policy "Enable all for authenticated users" on public.quotes for all to authenticated using (true) with check (true);

-- 5. QUOTE ITEMS (line items on quotes)
create table if not exists public.quote_items (
  id          uuid        primary key default gen_random_uuid(),
  quote_id    uuid        not null references public.quotes(id) on delete cascade,
  description text        not null,
  quantity    numeric     not null default 1 check (quantity > 0),
  unit_price  numeric     not null default 0 check (unit_price >= 0),
  total       numeric     not null default 0,
  sort_order  integer     not null default 0
);

create index if not exists idx_quote_items_quote on public.quote_items(quote_id);

alter table public.quote_items enable row level security;
drop policy if exists "Enable all for authenticated users" on public.quote_items;
create policy "Enable all for authenticated users" on public.quote_items for all to authenticated using (true) with check (true);

-- 6. FORECASTS (monthly sales targets + actuals)
create table if not exists public.forecasts (
  id          uuid        primary key default gen_random_uuid(),
  year        integer     not null,
  month       integer     not null check (month >= 1 and month <= 12),
  target      numeric     not null default 0,
  actual      numeric     not null default 0,
  created_by  text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(year, month, created_by)
);

drop trigger if exists trigger_forecasts_updated_at on public.forecasts;
create trigger trigger_forecasts_updated_at before update on public.forecasts for each row execute function handle_updated_at();

alter table public.forecasts enable row level security;
drop policy if exists "Enable all for authenticated users" on public.forecasts;
create policy "Enable all for authenticated users" on public.forecasts for all to authenticated using (true) with check (true);
