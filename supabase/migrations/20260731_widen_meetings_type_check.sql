-- ─────────────────────────────────────────────────────────────
-- NexusCRM – Widen entity CHECK constraints to match runtime unions
-- Created by the automation wiring sweep fix agent (F14).
--
-- Widens constraints that reject values the app type unions include
-- but the shipped schema does not:
--   meetings.type -> + video, in_person, other (MeetingType union,
--     types/meeting.types.ts:3)
--   tasks.status  -> + in_progress            (TaskStatus union,
--     types/task.types.ts:5 — flagged by F11; task.service treats
--     in_progress as an overdue-eligible status)
--
-- Verified-unchanged status/type/priority CHECKs (already match
-- their type unions): leads.status, leads.priority, tasks.priority,
-- quotes.status, email_sequences.status, invoices.status,
-- goals.type, goals.period, team_members.role, email_history.status,
-- sms_logs.status, campaign_recipients.status, webhook_events.status,
-- webhook_deliveries.status.
--
-- Safe to re-run — DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT.
-- ─────────────────────────────────────────────────────────────

alter table public.meetings drop constraint if exists meetings_type_check;
alter table public.meetings add constraint meetings_type_check
  check (type in ('online', 'offline', 'call', 'video', 'in_person', 'other'));

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('pending', 'completed', 'overdue', 'in_progress'));
