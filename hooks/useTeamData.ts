'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

  // Request-id guard: every load() call captures an id; a call only commits
  // its state if it is still the latest request AND the hook is mounted.
  // Bumping the counter in the effect cleanup also invalidates any in-flight
  // load after unmount, so no setState can fire on an unmounted component.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);

      /* 1. Get the real user ID from Supabase Auth (shared cache) */
      const user = await getCachedUser();
      if (requestIdRef.current !== requestId) return;
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
      if (requestIdRef.current !== requestId) return;
      setTeam(currentTeam ?? null);

      if (currentTeam) {
        const teamMembers = await teamService.getMembers(currentTeam.id);
        if (requestIdRef.current !== requestId) return;
        setMembers(teamMembers);
      } else {
        setMembers([]);
      }
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred while loading team data';
      setError(message);
    } finally {
      if (requestIdRef.current !== requestId) return;
      setLoading(false);
    }
  }, []);

  /* Load on mount */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      // Invalidate any in-flight load so it cannot set state after unmount
      requestIdRef.current += 1;
    };
  }, [load]);

  return { team, members, userId, loading, error, refresh: load };
}
