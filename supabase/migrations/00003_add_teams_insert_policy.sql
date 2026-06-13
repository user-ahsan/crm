-- Add missing INSERT policy for teams table
-- Without this, authenticated users cannot create teams in Supabase

create policy "Authenticated users can create teams"
  on public.teams for insert
  to authenticated
  with check (true);

-- Also ensure team_members insert works for team creation flow
create policy "Users can add themselves as members"
  on public.team_members for insert
  to authenticated
  with check (user_id = auth.uid());
