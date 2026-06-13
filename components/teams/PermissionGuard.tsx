'use client';

import type { ReactNode } from 'react';
import type { PermissionAction, PermissionEntity, PermissionScope } from '@/types/team.types';
import { usePermissions } from '@/hooks/usePermissions';
import { useTeamContext } from '@/context/TeamContext';

interface PermissionGuardProps {
  action: PermissionAction;
  entity: PermissionEntity;
  scope?: PermissionScope;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders children only if the current user has the specified permission.
 * - While role is loading: renders nothing (avoids "Access Denied" flash).
 * - If denied + fallback: renders fallback.
 * - If denied + no fallback: renders nothing (null).
 * No layout shift — uses inline rendering (no wrappers that affect layout).
 */
export function PermissionGuard({
  action,
  entity,
  scope,
  fallback,
  children,
}: PermissionGuardProps) {
  const { role, loading } = useTeamContext();
  const { hasPermission, canAccessRecord } = usePermissions(role);

  /* While loading, render nothing — avoids flashing "Access Denied" */
  if (loading) return null;

  const isAllowed = scope
    ? canAccessRecord(entity, scope)
    : hasPermission(action, entity);

  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return null;
}

export default PermissionGuard;
