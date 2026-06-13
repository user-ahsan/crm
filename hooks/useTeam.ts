'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Team, TeamMember, TeamInvitation, TeamFormData, InviteMemberFormData, TeamRole } from '@/types/team.types';
import { teamService } from '@/services/team.service';
import { createClient } from '@/lib/supabase/client';

export function useTeam() {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  /* Fetch the current user's ID on mount */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!cancelled) setUserId(user?.id ?? null);
      } catch {
        if (!cancelled) setUserId(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentTeam = await teamService.getCurrentTeam();
      setTeam(currentTeam);

      if (currentTeam) {
        const [teamMembers, teamInvitations] = await Promise.all([
          teamService.getMembers(currentTeam.id),
          teamService.getInvitations(currentTeam.id),
        ]);
        setMembers(teamMembers);
        setInvitations(teamInvitations);
      } else {
        setMembers([]);
        setInvitations([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /* Derive currentMember from the real user's ID */
  const currentMember: TeamMember | null =
    userId && members.length > 0
      ? members.find((m) => m.userId === userId) ?? null
      : null;

  const updateTeam = useCallback(async (data: TeamFormData) => {
    try {
      if (!team?.id) throw new Error('No team loaded');
      const updated = await teamService.update(team.id, data);
      if (updated) setTeam(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update team');
      throw e;
    }
  }, [team]);

  const inviteMember = useCallback(async (data: InviteMemberFormData) => {
    try {
      if (!team?.id) throw new Error('No team loaded');
      const newInvitation = await teamService.inviteMember(team.id, data);
      setInvitations((prev) => [newInvitation, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to invite member');
      throw e;
    }
  }, [team]);

  const cancelInvitation = useCallback(async (invitationId: string) => {
    try {
      const success = await teamService.cancelInvitation(invitationId);
      if (success) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel invitation');
      throw e;
    }
  }, []);

  const changeMemberRole = useCallback(async (memberId: string, role: TeamRole) => {
    try {
      const updated = await teamService.changeMemberRole(memberId, role);
      if (updated) {
        setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change member role');
      throw e;
    }
  }, []);

  const removeMember = useCallback(async (memberId: string) => {
    try {
      const success = await teamService.removeMember(memberId);
      if (success) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove member');
      throw e;
    }
  }, []);

  const createTeam = useCallback(async (data: TeamFormData) => {
    try {
      const newTeam = await teamService.create(data);

      /* Add the creator as an admin member via real Supabase */
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: newMember } = await supabase
        .from('team_members')
        .insert({
          team_id: newTeam.id,
          user_id: user.id,
          role: 'admin',
        })
        .select()
        .single();

      setTeam(newTeam);
      setMembers(newMember ? [mapDbToTeamMember(newMember)] : []);

      return newTeam;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create team');
      throw e;
    }
  }, []);

  return {
    team,
    members,
    invitations,
    currentMember,
    loading,
    error,
    updateTeam,
    inviteMember,
    cancelInvitation,
    changeMemberRole,
    removeMember,
    createTeam,
    refresh,
  };
}

function mapDbToTeamMember(row: Record<string, unknown>): TeamMember {
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    userId: row.user_id as string,
    role: row.role as TeamRole,
    joinedAt: row.joined_at as string,
  };
}
