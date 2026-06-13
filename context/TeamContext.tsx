'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  Team,
  TeamMember,
  TeamRole,
  PermissionAction,
  PermissionEntity,
  PermissionScope,
} from '@/types/team.types';
import { teamService } from '@/services/team.service';
import { hasPermission, canAccessRecord } from '@/modules/teams/teamPermissions';
import { useAuthStore } from '@/store/auth';

/* ── Context Value Interface ────────────────────────────────── */

export interface TeamContextValue {
  /** The current team (null if no team exists for the user). */
  team: Team | null;
  /** All members of the current team. */
  members: TeamMember[];
  /** The currently authenticated user's membership record (null if not a member). */
  currentMember: TeamMember | null;
  /** Shorthand for currentMember.role (null if not a member). */
  role: TeamRole | null;
  /** True while team data is being loaded. */
  loading: boolean;
  /** Non-null when an error occurred during loading. */
  error: string | null;
  /** Check if the current user's role allows a specific action on an entity. */
  hasPermission: (action: PermissionAction, entity: PermissionEntity) => boolean;
  /** Check if the current user's role can access records at a given scope. */
  canAccessRecord: (entity: PermissionEntity, scope: PermissionScope) => boolean;
  /** Re-fetch team and members from the service. */
  refresh: () => Promise<void>;
}

/* ── Context Instance ───────────────────────────────────────── */

const TeamContext = createContext<TeamContextValue | undefined>(undefined);

/* ── Provider ───────────────────────────────────────────────── */

export function TeamProvider({ children }: { children: ReactNode }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Derive current member from the authenticated user's ID */
  const user = useAuthStore((state) => state.user);
  const userId = user?.id ?? '';
  const currentMember = members.find((m) => m.userId === userId) ?? null;
  const role = currentMember?.role ?? null;

  /* ── Data Loader ────────────────────────────────────────── */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentTeam = await teamService.getCurrentTeam();
      setTeam(currentTeam);

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
    load();
  }, [load]);

  /* ── Permission Helpers (stable references via useMemo) ─── */
  const permissionHelpers = useMemo(() => {
    const checkPermission = (action: PermissionAction, entity: PermissionEntity): boolean => {
      if (!role) return false;
      return hasPermission(role, action, entity);
    };

    const checkAccess = (entity: PermissionEntity, scope: PermissionScope): boolean => {
      if (!role) return false;
      return canAccessRecord(role, entity, scope);
    };

    return { hasPermission: checkPermission, canAccessRecord: checkAccess };
  }, [role]);

  /* ── Memoised Context Value ─────────────────────────────── */
  const value = useMemo<TeamContextValue>(
    () => ({
      team,
      members,
      currentMember,
      role,
      loading,
      error,
      ...permissionHelpers,
      refresh: load,
    }),
    [team, members, currentMember, role, loading, error, permissionHelpers, load],
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

/* ── Consumer Hook ──────────────────────────────────────────── */

export function useTeamContext(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) {
    throw new Error('useTeamContext must be used within a TeamProvider');
  }
  return ctx;
}
