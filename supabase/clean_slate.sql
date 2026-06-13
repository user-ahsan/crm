-- ─────────────────────────────────────────────────────────────
-- NexusCRM – UNIVERSAL Clean Slate
--
-- Drops EVERYTHING in the public schema dynamically:
--   ✓ All RLS policies on every table
--   ✓ All tables (any number, any names)
--   ✓ All functions (including trigger functions)
--   ✓ All triggers
--   ✓ All sequences
--   ✓ All extensions (optional)
--   ✓ All indexes
--   ✓ All constraints
--
-- WARNING: This will DELETE ALL DATA in your Supabase project.
-- It is GENERIC — works on ANY Postgres database, not just NexusCRM.
-- After running this, run your migration scripts to rebuild.
-- ─────────────────────────────────────────────────────────────

do $$ 
declare 
  rec record;
begin 
  -- ── 1. Drop ALL RLS policies on ALL tables ────────────────
  for rec in (
    select schemaname || '.' || tablename as full_table, policyname
    from pg_policies
    where schemaname = 'public'
  ) loop
    execute format('drop policy if exists %I on %s', rec.policyname, rec.full_table);
  end loop;

  -- ── 2. Disable RLS + force RLS on ALL tables ─────────────
  for rec in (
    select tablename 
    from pg_tables 
    where schemaname = 'public'
  ) loop
    execute format('alter table if exists public.%I no force row level security', rec.tablename);
  end loop;

  -- ── 3. Drop ALL triggers on ALL tables ───────────────────
  for rec in (
    select event_object_schema || '.' || event_object_table as full_table, trigger_name
    from information_schema.triggers
    where trigger_schema = 'public'
  ) loop
    execute format('drop trigger if exists %I on %s cascade', rec.trigger_name, rec.full_table);
  end loop;

  -- ── 4. Drop ALL functions (including trigger functions) ──
  for rec in (
    select ns.nspname || '.' || p.proname as full_name, p.oid
    from pg_proc p
    join pg_namespace ns on p.pronamespace = ns.oid
    where ns.nspname = 'public'
      and p.prokind in ('f', 'p')  -- f = normal function, p = procedure
  ) loop
    execute format('drop function if exists %s cascade', rec.full_name);
  end loop;

  -- ── 5. Drop ALL tables in the public schema (any order, cascade handles deps) ──
  for rec in (
    select tablename 
    from pg_tables 
    where schemaname = 'public'
    order by tablename  -- alphabetical is irrelevant; cascade resolves deps
  ) loop
    execute format('drop table if exists public.%I cascade', rec.tablename);
  end loop;

  -- ── 6. Drop ALL sequences ────────────────────────────────
  for rec in (
    select sequence_name 
    from information_schema.sequences 
    where sequence_schema = 'public'
  ) loop
    execute format('drop sequence if exists public.%I cascade', rec.sequence_name);
  end loop;

  -- ── 7. Drop ALL views ────────────────────────────────────
  for rec in (
    select table_name 
    from information_schema.views 
    where table_schema = 'public'
  ) loop
    execute format('drop view if exists public.%I cascade', rec.table_name);
  end loop;

  -- ── 8. Clean up pgcrypto if you want (optional) ─────────
  -- Uncomment the line below if you want to DROP the extension too:
  -- drop extension if exists "pgcrypto" cascade;

end $$;

-- ── 9. Verify: Should return 0 rows ────────────────────────
select 
  'tables' as object_type, count(*)::text as remaining 
from pg_tables where schemaname = 'public'
union all
select 'views', count(*)::text 
from information_schema.views where table_schema = 'public'
union all
select 'functions', count(*)::text 
from pg_proc p join pg_namespace ns on p.pronamespace = ns.oid 
where ns.nspname = 'public' and p.prokind in ('f', 'p')
union all
select 'triggers', count(*)::text 
from information_schema.triggers where trigger_schema = 'public';

-- ─────────────────────────────────────────────────────────────
-- After this, run your migration (e.g., 00001_initial_schema.sql)
-- to rebuild the database from scratch.
-- ─────────────────────────────────────────────────────────────
