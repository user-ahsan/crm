import { createClient } from '@/lib/supabase/client';
import type { Team, TeamMember, TeamInvitation, TeamFormData, InviteMemberFormData, TeamRole } from '@/types/team.types';
import type { DbTeam, DbTeamMember, DbTeamInvitation } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

function mapRowToTeam(row: DbTeam): Team {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTeamToDb(team: Partial<TeamFormData>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (team.name !== undefined) db.name = team.name;
  if (team.description !== undefined) db.description = team.description || null;
  return db;
}

function mapRowToTeamMember(row: DbTeamMember): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role as TeamRole,
    joinedAt: row.joined_at,
  };
}

function mapRowToTeamInvitation(row: DbTeamInvitation): TeamInvitation {
  return {
    id: row.id,
    teamId: row.team_id,
    email: row.email,
    role: row.role as TeamRole,
    invitedBy: row.invited_by,
    status: row.status as TeamInvitation['status'],
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export const teamService = {
  async getCurrentTeam(): Promise<Team | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .limit(1)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(error.message);
      }
      return data ? mapRowToTeam(data as DbTeam) : null;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to get current team');
    }
  },

  async getMembers(teamId: string): Promise<TeamMember[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId);
      if (error) throw new Error(error.message);
      return (data as DbTeamMember[] | null)?.map(mapRowToTeamMember) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to get team members');
    }
  },

  async getInvitations(teamId: string): Promise<TeamInvitation[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', teamId);
      if (error) throw new Error(error.message);
      return (data as DbTeamInvitation[] | null)?.map(mapRowToTeamInvitation) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to get invitations');
    }
  },

  async create(data: TeamFormData): Promise<Team> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();

      /* Get the real authenticated user's ID */
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error(userError?.message ?? 'Not authenticated');

      const dbRow = {
        name: data.name,
        description: data.description ?? null,
        created_by: user.id,
        created_at: now,
        updated_at: now,
      };
      const { data: inserted, error } = await supabase
        .from('teams')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapRowToTeam(inserted as DbTeam);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to create team');
    }
  },

  async update(id: string, data: Partial<TeamFormData>): Promise<Team | undefined> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();
      const dbData: Record<string, unknown> = { ...mapTeamToDb(data), updated_at: now };
      const { data: updated, error } = await supabase
        .from('teams')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return mapRowToTeam(updated as DbTeam);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to update team');
    }
  },

  async inviteMember(teamId: string, data: InviteMemberFormData): Promise<TeamInvitation> {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const supabase = await createClient();

      /* Get the real authenticated user's ID */
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error(userError?.message ?? 'Not authenticated');

      const dbRow = {
        team_id: teamId,
        email: data.email,
        role: data.role,
        invited_by: user.id,
        status: 'pending',
        expires_at: expiresAt,
        created_at: now,
      };
      const { data: inserted, error } = await supabase
        .from('team_invitations')
        .insert(dbRow)
        .select()
        .single();
      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          throw new Error('An invitation has already been sent to this email');
        }
        throw new Error(error.message);
      }
      return mapRowToTeamInvitation(inserted as DbTeamInvitation);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to invite member');
    }
  },

  async cancelInvitation(invitationId: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to cancel invitation');
    }
  },

  async changeMemberRole(memberId: string, role: TeamRole): Promise<TeamMember | undefined> {
    try {
      const supabase = await createClient();
      const { data: updated, error } = await supabase
        .from('team_members')
        .update({ role })
        .eq('id', memberId)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return mapRowToTeamMember(updated as DbTeamMember);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to change member role');
    }
  },

  async removeMember(memberId: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to remove member');
    }
  },
};
