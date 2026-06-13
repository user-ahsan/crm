-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Clean Slate: Drop ALL tables, policies, triggers
-- ─────────────────────────────────────────────────────────────
-- WARNING: This will DELETE ALL DATA in your Supabase project.
-- Only run this if you want to start completely fresh.
-- After running this, run 00001_initial_schema.sql to rebuild.
-- ─────────────────────────────────────────────────────────────

-- 1. Drop ALL RLS policies first (order doesn't matter for policies)
do $$
declare
  pol record;
begin
  for pol in (
    select policyname, tablename, schemaname
    from pg_policies
    where schemaname = 'public'
  ) loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- 2. Disable RLS on all tables
alter table if exists public.team_invitations no force row level security;
alter table if exists public.team_members no force row level security;
alter table if exists public.teams no force row level security;
alter table if exists public.activities no force row level security;
alter table if exists public.meetings no force row level security;
alter table if exists public.tasks no force row level security;
alter table if exists public.contacts no force row level security;
alter table if exists public.companies no force row level security;
alter table if exists public.leads no force row level security;

-- 3. Drop all tables in correct dependency order
drop table if exists public.team_invitations cascade;
drop table if exists public.team_members cascade;
drop table if exists public.teams cascade;
drop table if exists public.activities cascade;
drop table if exists public.meetings cascade;
drop table if exists public.tasks cascade;
drop table if exists public.contacts cascade;
drop table if exists public.companies cascade;
drop table if exists public.leads cascade;

-- 4. Drop the trigger function
drop function if exists public.handle_updated_at cascade;

-- 5. Verify everything is clean
select table_name from information_schema.tables where table_schema = 'public';
-- Expected: empty result set (no tables)

-- ─────────────────────────────────────────────────────────────
-- After this, run supabase/migrations/00001_initial_schema.sql
-- to rebuild the database from scratch.
-- ─────────────────────────────────────────────────────────────
