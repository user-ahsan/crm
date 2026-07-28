import { getSharedClient } from '@/lib/supabase/client';
import type { Team, TeamMember, TeamInvitation, TeamFormData, InviteMemberFormData, TeamRole } from '@/types/team.types';
import type { DbTeam, DbTeamMember, DbTeamInvitation, TeamInsert } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';

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

function mapTeamToDb(team: Partial<TeamFormData>): Partial<TeamInsert> {
  const db: Partial<TeamInsert> = {};
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
  async getCurrentTeam(): Promise<Team | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .limit(1)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data ? mapRowToTeam(data as DbTeam) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getMembers(teamId: string): Promise<TeamMember[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId);
      if (error) throw toServiceError(error);
      return (data as DbTeamMember[] | null)?.map(mapRowToTeamMember) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getInvitations(teamId: string): Promise<TeamInvitation[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', teamId);
      if (error) throw toServiceError(error);
      return (data as DbTeamInvitation[] | null)?.map(mapRowToTeamInvitation) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async create(data: TeamFormData): Promise<Team> {
    try {
      const supabase = await getSharedClient();

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw toServiceError(userError ?? new Error('Not authenticated'));

      const dbRow = {
        name: data.name,
        description: data.description ?? null,
        created_by: user.id,
      };
      const { data: inserted, error } = await supabase
        .from('teams')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw toServiceError(error);
      const team = mapRowToTeam(inserted as DbTeam);
      activityService.log('team', team.id, 'created', `Team created: ${team.name}`);
      triggerWebhook('team.created', { id: team.id, name: team.name });
      return team;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async update(id: string, data: Partial<TeamFormData>): Promise<Team | undefined> {
    try {
      const supabase = await getSharedClient();
      const dbData = { ...mapTeamToDb(data) };
      const { data: updated, error } = await supabase
        .from('teams')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      const team = mapRowToTeam(updated as DbTeam);
      activityService.log('team', id, 'updated', `Team updated: ${team.name}`);
      triggerWebhook('team.updated', { id, ...data });
      return team;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async inviteMember(teamId: string, data: InviteMemberFormData): Promise<TeamInvitation> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const supabase = await getSharedClient();

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw toServiceError(userError ?? new Error('Not authenticated'));

      const dbRow = {
        team_id: teamId,
        email: data.email,
        role: data.role,
        invited_by: user.id,
        status: 'pending',
        expires_at: expiresAt,
      };
      const { data: inserted, error } = await supabase
        .from('team_invitations')
        .insert(dbRow)
        .select()
        .single();
      if (error) {
        if (error.code === '23505') {
          throw new ServiceError('An invitation has already been sent to this email', 'DUPLICATE_INVITATION');
        }
        throw toServiceError(error);
      }
      return mapRowToTeamInvitation(inserted as DbTeamInvitation);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async cancelInvitation(invitationId: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async changeMemberRole(memberId: string, role: TeamRole): Promise<TeamMember | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data: updated, error } = await supabase
        .from('team_members')
        .update({ role })
        .eq('id', memberId)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return mapRowToTeamMember(updated as DbTeamMember);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async removeMember(memberId: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async createTeamWithAdmin(data: TeamFormData): Promise<{ team: Team; member: TeamMember }> {
    const supabase = await getSharedClient();
    let team: Team | undefined;

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw toServiceError(userError ?? new Error('Not authenticated'));

      const dbRow = {
        name: data.name,
        description: data.description ?? null,
        created_by: user.id,
      };
      const { data: inserted, error } = await supabase
        .from('teams')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw toServiceError(error);
      team = mapRowToTeam(inserted as DbTeam);

      const { data: newMember, error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: user.id,
          role: 'admin',
        })
        .select()
        .single();
      if (memberError) {
        // Roll back team creation if member insert failed
        if (team) {
          const { error: rollbackErr } = await supabase.from('teams').delete().eq('id', team.id);
          if (rollbackErr) {
            console.error(`Rollback delete team ${team.id} failed: ${rollbackErr.message}`);
          }
        }
        throw toServiceError(memberError);
      }

      const member = mapRowToTeamMember(newMember as DbTeamMember);
      activityService.log('team', team.id, 'created', `Team created: ${team.name}`);
      triggerWebhook('team.created', { id: team.id, name: team.name });
      return { team, member };
    } catch (e) {
      // Roll back team creation if member insert failed
      if (team) {
        const { error: rollbackErr } = await supabase.from('teams').delete().eq('id', team.id);
        if (rollbackErr) {
          console.error(`Rollback delete team ${team.id} failed: ${rollbackErr.message}`);
        }
      }
      throw toServiceError(e);
    }
  },
};
