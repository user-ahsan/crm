-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Campaign Scheduler: claim timestamp for stale reclaim
--
-- Adds campaign_recipients.claimed_at so the scheduler can reset
-- rows stranded in 'processing' by a crashed/aborted run back to
-- 'pending' after a stale horizon (15 minutes). Written by fix
-- agent F17 (campaign + scheduler services).
--
-- The regenerated Database types do not yet carry claimed_at; the
-- scheduler references it through a local extension of the update
-- contract (CampaignRecipientClaimUpdate in campaign-scheduler.
-- service.ts). Re-run the type generator after applying this
-- migration to fold the column into types/supabase.types.ts.
--
-- Safe to re-run — IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────

alter table public.campaign_recipients
  add column if not exists claimed_at timestamptz;

-- Partial index matching the reclaim query
-- (status = 'processing' AND claimed_at < cutoff).
create index if not exists idx_campaign_recipients_claimed
  on public.campaign_recipients(claimed_at)
  where status = 'processing';
