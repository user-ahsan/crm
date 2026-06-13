import { teams as mockTeams } from '@/data/teams';
import { teamMembers as mockTeamMembers } from '@/data/team-members';
import { teamInvitations as mockTeamInvitations } from '@/data/team-invitations';
import type { Team, TeamMember, TeamInvitation, TeamFormData, InviteMemberFormData, TeamRole } from '@/types/team.types';
import { generateId } from '@/lib/formatters';
import { isSupabaseConfigured, getSupabaseClient as getSupabaseClientAsync, formatSupabaseError } from './supabase.service';

export const teamService = {
  async getCurrentTeam(): Promise<Team | null> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = await getSupabaseClientAsync();
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .limit(1)
          .single();
        if (error) {
          if (error.code === 'PGRST116') return null;
          throw new Error(formatSupabaseError(error));
        }
        return data as Team | null;
      }
      return mockTeams[0] ?? null;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to get current team');
    }
  },

  async getMembers(teamId: string): Promise<TeamMember[]> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = await getSupabaseClientAsync();
        const { data, error } = await supabase
          .from('team_members')
          .select('*')
          .eq('team_id', teamId);
        if (error) throw new Error(formatSupabaseError(error));
        return (data as TeamMember[] | null) ?? [];
      }
      return mockTeamMembers.filter((m) => m.teamId === teamId);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to get team members');
    }
  },

  async getInvitations(teamId: string): Promise<TeamInvitation[]> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = await getSupabaseClientAsync();
        const { data, error } = await supabase
          .from('team_invitations')
          .select('*')
          .eq('team_id', teamId);
        if (error) throw new Error(formatSupabaseError(error));
        return (data as TeamInvitation[] | null) ?? [];
      }
      return mockTeamInvitations.filter((inv) => inv.teamId === teamId);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to get invitations');
    }
  },

  async create(data: TeamFormData): Promise<Team> {
    const now = new Date().toISOString();
    try {
      if (isSupabaseConfigured()) {
        const supabase = await getSupabaseClientAsync();
        const dbRow = {
          name: data.name,
          description: data.description ?? null,
          created_by: '00000000-0000-0000-0000-000000000001',
          created_at: now,
          updated_at: now,
        };
        const { data: inserted, error } = await supabase
          .from('teams')
          .insert(dbRow)
          .select()
          .single();
        if (error) throw new Error(formatSupabaseError(error));
        return inserted as Team;
      }
      const newTeam: Team = {
        id: `team-${generateId().slice(0, 8)}`,
        name: data.name,
        description: data.description,
        createdBy: 'user-1',
        createdAt: now,
        updatedAt: now,
      };
      mockTeams.unshift(newTeam);
      return newTeam;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to create team');
    }
  },

  async update(id: string, data: Partial<TeamFormData>): Promise<Team | undefined> {
    const now = new Date().toISOString();
    try {
      if (isSupabaseConfigured()) {
        const supabase = await getSupabaseClientAsync();
        const dbData: Record<string, unknown> = { updated_at: now };
        if (data.name !== undefined) dbData.name = data.name;
        if (data.description !== undefined) dbData.description = data.description ?? null;
        const { data: updated, error } = await supabase
          .from('teams')
          .update(dbData)
          .eq('id', id)
          .select()
          .single();
        if (error) {
          if (error.code === 'PGRST116') return undefined;
          throw new Error(formatSupabaseError(error));
        }
        return updated as Team;
      }
      const index = mockTeams.findIndex((t) => t.id === id);
      if (index === -1) return undefined;
      const updated: Team = {
        ...mockTeams[index],
        ...data,
        updatedAt: now,
      };
      mockTeams[index] = updated;
      return updated;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to update team');
    }
  },

  async inviteMember(teamId: string, data: InviteMemberFormData): Promise<TeamInvitation> {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      if (isSupabaseConfigured()) {
        const supabase = await getSupabaseClientAsync();
        const dbRow = {
          team_id: teamId,
          email: data.email,
          role: data.role,
          invited_by: '00000000-0000-0000-0000-000000000001',
          status: 'pending',
          expires_at: expiresAt,
          created_at: now,
        };
        const { data: inserted, error } = await supabase
          .from('team_invitations')
          .insert(dbRow)
          .select()
          .single();
        if (error) throw new Error(formatSupabaseError(error));
        return inserted as TeamInvitation;
      }
      const existingInvitation = mockTeamInvitations.find(
        (inv) => inv.teamId === teamId && inv.email === data.email && inv.status === 'pending',
      );
      if (existingInvitation) {
        throw new Error('An invitation has already been sent to this email');
      }
      const existingMember = mockTeamMembers.find(
        (m) => m.teamId === teamId && m.user?.email === data.email,
      );
      if (existingMember) {
        throw new Error('User is already a team member');
      }
      const newInvitation: TeamInvitation = {
        id: `inv-${generateId().slice(0, 8)}`,
        teamId,
        email: data.email,
        role: data.role,
        invitedBy: 'user-1',
        status: 'pending',
        expiresAt,
        createdAt: now,
      };
      mockTeamInvitations.unshift(newInvitation);
      return newInvitation;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to invite member');
    }
  },

  async cancelInvitation(invitationId: string): Promise<boolean> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = await getSupabaseClientAsync();
        const { error } = await supabase
          .from('team_invitations')
          .delete()
          .eq('id', invitationId);
        if (error) throw new Error(formatSupabaseError(error));
        return true;
      }
      const index = mockTeamInvitations.findIndex((inv) => inv.id === invitationId);
      if (index === -1) return false;
      mockTeamInvitations.splice(index, 1);
      return true;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to cancel invitation');
    }
  },

  async changeMemberRole(memberId: string, role: TeamRole): Promise<TeamMember | undefined> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = await getSupabaseClientAsync();
        const { data: updated, error } = await supabase
          .from('team_members')
          .update({ role })
          .eq('id', memberId)
          .select()
          .single();
        if (error) {
          if (error.code === 'PGRST116') return undefined;
          throw new Error(formatSupabaseError(error));
        }
        return updated as TeamMember;
      }
      const index = mockTeamMembers.findIndex((m) => m.id === memberId);
      if (index === -1) return undefined;
      const updated: TeamMember = {
        ...mockTeamMembers[index],
        role,
      };
      mockTeamMembers[index] = updated;
      return updated;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to change member role');
    }
  },

  async removeMember(memberId: string): Promise<boolean> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = await getSupabaseClientAsync();
        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('id', memberId);
        if (error) throw new Error(formatSupabaseError(error));
        return true;
      }
      const index = mockTeamMembers.findIndex((m) => m.id === memberId);
      if (index === -1) return false;
      const memberToRemove = mockTeamMembers[index];
      if (memberToRemove.role === 'admin') {
        const adminCount = mockTeamMembers.filter((m) => m.role === 'admin').length;
        if (adminCount <= 1) {
          throw new Error('Cannot remove the last admin. Promote another member to admin first.');
        }
      }
      mockTeamMembers.splice(index, 1);
      return true;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to remove member');
    }
  },
};
