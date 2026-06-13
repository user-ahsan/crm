'use client';

import { useState, useCallback, useEffect } from 'react';
import type { TeamInvitation, TeamFormData, InviteMemberFormData, TeamRole } from '@/types/team.types';
import { teamService } from '@/services/team.service';
import { useTeamContext } from '@/context/TeamContext';

export function useTeam() {
  const { team, members, currentMember, loading, error: contextError, refresh: refreshContext } = useTeamContext();
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      if (team) {
        try {
          const teamInvitations = await teamService.getInvitations(team.id);
          if (!cancelled) setInvitations(teamInvitations);
        } catch {
          if (!cancelled) setInvitations([]);
        }
      } else {
        if (!cancelled) setInvitations([]);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [team]);

  const error = mutationError || contextError;

  const updateTeam = useCallback(async (data: TeamFormData) => {
    try {
      if (!team?.id) throw new Error('No team loaded');
      await teamService.update(team.id, data);
      await refreshContext();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Failed to update team');
      throw e;
    }
  }, [team, refreshContext]);

  const inviteMember = useCallback(async (data: InviteMemberFormData) => {
    try {
      if (!team?.id) throw new Error('No team loaded');
      const newInvitation = await teamService.inviteMember(team.id, data);
      setInvitations((prev) => [newInvitation, ...prev]);
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Failed to invite member');
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
      setMutationError(e instanceof Error ? e.message : 'Failed to cancel invitation');
      throw e;
    }
  }, []);

  const changeMemberRole = useCallback(async (memberId: string, role: TeamRole) => {
    try {
      await teamService.changeMemberRole(memberId, role);
      await refreshContext();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Failed to change member role');
      throw e;
    }
  }, [refreshContext]);

  const removeMember = useCallback(async (memberId: string) => {
    try {
      await teamService.removeMember(memberId);
      await refreshContext();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Failed to remove member');
      throw e;
    }
  }, [refreshContext]);

  const createTeam = useCallback(async (data: TeamFormData) => {
    try {
      const result = await teamService.createTeamWithAdmin(data);
      await refreshContext();
      return result.team;
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Failed to create team');
      throw e;
    }
  }, [refreshContext]);

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
    refresh: refreshContext,
  };
}
