'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Team, TeamMember, TeamInvitation, TeamFormData, InviteMemberFormData, TeamRole } from '@/types/team.types';
import { teamService } from '@/services/team.service';

const DEFAULT_TEAM_ID = 'team-001';

export function useTeam() {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const currentMember: TeamMember | null = members.length > 0
    ? (members.find((m) => m.userId === 'user-1') ?? members[0])
    : null;

  const updateTeam = useCallback(async (data: TeamFormData) => {
    try {
      const teamId = team?.id ?? DEFAULT_TEAM_ID;
      const updated = await teamService.update(teamId, data);
      if (updated) setTeam(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update team');
      throw e;
    }
  }, [team]);

  const inviteMember = useCallback(async (data: InviteMemberFormData) => {
    try {
      const teamId = team?.id ?? DEFAULT_TEAM_ID;
      const newInvitation = await teamService.inviteMember(teamId, data);
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
      setTeam(newTeam);
      // Add current user as admin member in mock data
      const { teamMembers } = await import('@/data/team-members');
      const { generateId } = await import('@/lib/formatters');
      teamMembers.push({
        id: `tm-${generateId().slice(0, 8)}`,
        teamId: newTeam.id,
        userId: 'user-1', // current user
        role: 'admin',
        joinedAt: new Date().toISOString(),
        user: { name: 'Current User', email: 'user@nexuscrm.com' },
      });
      setMembers([...teamMembers.filter(m => m.teamId === newTeam.id)]);
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
