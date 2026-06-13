'use client';

import type { TeamRole, PermissionAction, PermissionEntity, PermissionScope } from '@/types/team.types';
import {
  hasPermission as evaluatePermission,
  canAccessRecord as evaluateAccess,
  canCreate as evaluateCreate,
  canRead as evaluateRead,
  canUpdate as evaluateUpdate,
  canDelete as evaluateDelete,
} from '@/modules/teams/teamPermissions';

/**
 * Hook that provides permission-checking helpers based on the current user's role.
 * Designed to be used with TeamContext, but accepts an explicit role for flexibility.
 *
 * Usage:
 *   const perms = usePermissions(role);
 *   if (perms.canCreate('lead')) { ... }
 *   if (perms.canAccessRecord('lead', 'own')) { ... }
 */
export function usePermissions(role: TeamRole | null) {
  const hasPermission = (action: PermissionAction, entity: PermissionEntity): boolean => {
    if (!role) return false;
    return evaluatePermission(role, action, entity);
  };

  const canAccessRecord = (entity: PermissionEntity, scope: PermissionScope): boolean => {
    if (!role) return false;
    return evaluateAccess(role, entity, scope);
  };

  const canCreate = (entity: PermissionEntity): boolean => {
    if (!role) return false;
    return evaluateCreate(role, entity);
  };

  const canRead = (entity: PermissionEntity): boolean => {
    if (!role) return false;
    return evaluateRead(role, entity);
  };

  const canUpdate = (entity: PermissionEntity): boolean => {
    if (!role) return false;
    return evaluateUpdate(role, entity);
  };

  const canDelete = (entity: PermissionEntity): boolean => {
    if (!role) return false;
    return evaluateDelete(role, entity);
  };

  const canManageTeam = (): boolean => {
    if (!role) return false;
    return role === 'admin';
  };

  /**
   * Check if the role is at least a given level.
   * Hierarchy: viewer < agent < manager < admin
   */
  const isAtLeast = (minimumRole: TeamRole): boolean => {
    if (!role) return false;
    const hierarchy: Record<TeamRole, number> = {
      viewer: 0,
      agent: 1,
      manager: 2,
      admin: 3,
    };
    return hierarchy[role] >= hierarchy[minimumRole];
  };

  return { hasPermission, canAccessRecord, canCreate, canRead, canUpdate, canDelete, canManageTeam, isAtLeast, role };
}
