'use client';

import {
  createContext,
  useContext,
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
import { useTeamData } from '@/hooks/useTeamData';
import { hasPermission, canAccessRecord } from '@/modules/teams/teamPermissions';

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
  const {
    team,
    members,
    userId,
    loading,
    error,
    refresh,
  } = useTeamData();

  /* Derive current member from the real user's ID */
  const currentMember = userId ? members.find((m) => m.userId === userId) ?? null : null;
  const role = currentMember?.role ?? null;

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
      refresh,
    }),
    [team, members, currentMember, role, loading, error, permissionHelpers, refresh],
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
