-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Wave 5: Polymorphic Tagging System
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ─────────────────────────────────────────────────────────────

-- 1. TAGS TABLE
create table if not exists public.tags (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  color      text        not null default '#6366f1', -- indigo-500
  created_at timestamptz not null default now()
);

-- 2. TAGGINGS TABLE (polymorphic — can tag any entity)
create table if not exists public.taggings (
  id            uuid   primary key default gen_random_uuid(),
  tag_id        uuid   not null references public.tags(id) on delete cascade,
  taggable_id   text   not null,
  taggable_type text   not null check (taggable_type in ('lead', 'contact', 'company', 'task', 'meeting', 'deal')),
  created_at    timestamptz not null default now(),
  unique(tag_id, taggable_id, taggable_type)
);

-- 3. INDEXES
create index if not exists idx_taggings_tag_id        on public.taggings(tag_id);
create index if not exists idx_taggings_taggable      on public.taggings(taggable_id, taggable_type);
create index if not exists idx_taggings_taggable_type on public.taggings(taggable_type);
create index if not exists idx_tags_name              on public.tags(name);

-- 4. RLS
alter table public.tags      enable row level security;
alter table public.taggings  enable row level security;

-- Tags: all authenticated users can CRUD tags
drop policy if exists "Enable all for authenticated users" on public.tags;
create policy "Enable all for authenticated users" on public.tags for all to authenticated using (true) with check (true);

-- Taggings: all authenticated users can CRUD taggings
drop policy if exists "Enable all for authenticated users" on public.taggings;
create policy "Enable all for authenticated users" on public.taggings for all to authenticated using (true) with check (true);
