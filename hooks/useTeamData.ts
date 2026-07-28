'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Team, TeamMember } from '@/types/team.types';
import { teamService } from '@/services/team.service';
import { getCachedUser } from '@/lib/cached-user';

export interface TeamDataState {
  /** The current team (null if no team exists for the user). */
  team: Team | null;
  /** All members of the current team. */
  members: TeamMember[];
  /** The authenticated user's ID (null if no session). */
  userId: string | null;
  /** True while team data is being loaded. */
  loading: boolean;
  /** Non-null when an error occurred during loading. */
  error: string | null;
  /** Re-fetch team and members from the service. */
  refresh: () => Promise<void>;
}

/**
 * Hook that encapsulates team data loading from the service layer.
 *
 * This is the data‑loading counterpart to useTeam (which provides
 * mutation methods like inviteMember, changeMemberRole, etc.).
 * It is used internally by TeamContext to avoid direct service
 * imports in the context layer.
 */
export function useTeamData(): TeamDataState {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      /* 1. Get the real user ID from Supabase Auth (shared cache) */
      const user = await getCachedUser();
      const uid = user?.id ?? null;
      setUserId(uid);

      /* 2. If we have no authenticated user, stop here */
      if (!uid) {
        setTeam(null);
        setMembers([]);
        return;
      }

      /* 3. Load team data */
      const currentTeam = await teamService.getCurrentTeam();
      setTeam(currentTeam ?? null);

      if (currentTeam) {
        const teamMembers = await teamService.getMembers(currentTeam.id);
        setMembers(teamMembers);
      } else {
        setMembers([]);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred while loading team data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Load on mount */
  useEffect(() => {
    let cancelled = false;
    load().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [load]);

  return { team, members, userId, loading, error, refresh: load };
}
