-- ─────────────────────────────────────────────────────────────
-- Persistent in-app notifications (20260731)
--
-- Backs notificationService.getAll/markAsRead/markAllAsRead/
-- create/dismiss and realtimeService.getPendingNotifications.
-- `type` stores the NotificationEvent union values written by
-- notificationService.create (validated at the service layer).
-- RLS is user-scoped (PATTERN-rls style: own rows only), matching
-- the "Users can X own notifications" policy shape used across the
-- auxiliary tables in 20260726_rls_policies.sql.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id          uuid         primary key default gen_random_uuid(),
  user_id     text         not null,
  type        text         not null,
  title       text         not null,
  body        text         not null,
  entity_type text         null,
  entity_id   text         null,
  read_at     timestamptz  null,
  created_at  timestamptz  not null default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, read_at);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists "Users can insert own notifications" on public.notifications;
create policy "Users can insert own notifications"
  on public.notifications for insert to authenticated
  with check (user_id = auth.uid()::text);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid()::text);
