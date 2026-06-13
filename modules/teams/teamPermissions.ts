import type { TeamRole, Permission, PermissionAction, PermissionEntity, PermissionScope } from '@/types/team.types';

/* ── Role-to-Permission Mapping ─────────────────────────────── */

const ROLE_PERMISSIONS: Record<TeamRole, readonly Permission[]> = {
  admin: [
    { action: 'create', entity: 'lead', scope: 'all' },
    { action: 'read', entity: 'lead', scope: 'all' },
    { action: 'update', entity: 'lead', scope: 'all' },
    { action: 'delete', entity: 'lead', scope: 'all' },
    { action: 'create', entity: 'contact', scope: 'all' },
    { action: 'read', entity: 'contact', scope: 'all' },
    { action: 'update', entity: 'contact', scope: 'all' },
    { action: 'delete', entity: 'contact', scope: 'all' },
    { action: 'create', entity: 'company', scope: 'all' },
    { action: 'read', entity: 'company', scope: 'all' },
    { action: 'update', entity: 'company', scope: 'all' },
    { action: 'delete', entity: 'company', scope: 'all' },
    { action: 'create', entity: 'task', scope: 'all' },
    { action: 'read', entity: 'task', scope: 'all' },
    { action: 'update', entity: 'task', scope: 'all' },
    { action: 'delete', entity: 'task', scope: 'all' },
    { action: 'create', entity: 'meeting', scope: 'all' },
    { action: 'read', entity: 'meeting', scope: 'all' },
    { action: 'update', entity: 'meeting', scope: 'all' },
    { action: 'delete', entity: 'meeting', scope: 'all' },
    { action: 'read', entity: 'analytics', scope: 'all' },
    { action: 'read', entity: 'team', scope: 'all' },
    { action: 'update', entity: 'team', scope: 'all' },
    { action: 'delete', entity: 'team', scope: 'all' },
  ],
  manager: [
    { action: 'create', entity: 'lead', scope: 'team' },
    { action: 'read', entity: 'lead', scope: 'all' },
    { action: 'update', entity: 'lead', scope: 'team' },
    { action: 'delete', entity: 'lead', scope: 'team' },
    { action: 'create', entity: 'contact', scope: 'team' },
    { action: 'read', entity: 'contact', scope: 'all' },
    { action: 'update', entity: 'contact', scope: 'team' },
    { action: 'delete', entity: 'contact', scope: 'team' },
    { action: 'create', entity: 'company', scope: 'team' },
    { action: 'read', entity: 'company', scope: 'all' },
    { action: 'update', entity: 'company', scope: 'team' },
    { action: 'delete', entity: 'company', scope: 'team' },
    { action: 'create', entity: 'task', scope: 'team' },
    { action: 'read', entity: 'task', scope: 'all' },
    { action: 'update', entity: 'task', scope: 'team' },
    { action: 'delete', entity: 'task', scope: 'team' },
    { action: 'create', entity: 'meeting', scope: 'team' },
    { action: 'read', entity: 'meeting', scope: 'all' },
    { action: 'update', entity: 'meeting', scope: 'team' },
    { action: 'delete', entity: 'meeting', scope: 'team' },
    { action: 'read', entity: 'analytics', scope: 'all' },
    { action: 'read', entity: 'team', scope: 'team' },
  ],
  agent: [
    { action: 'create', entity: 'lead', scope: 'own' },
    { action: 'read', entity: 'lead', scope: 'own' },
    { action: 'update', entity: 'lead', scope: 'own' },
    { action: 'delete', entity: 'lead', scope: 'own' },
    { action: 'create', entity: 'contact', scope: 'own' },
    { action: 'read', entity: 'contact', scope: 'own' },
    { action: 'update', entity: 'contact', scope: 'own' },
    { action: 'delete', entity: 'contact', scope: 'own' },
    { action: 'create', entity: 'company', scope: 'own' },
    { action: 'read', entity: 'company', scope: 'own' },
    { action: 'update', entity: 'company', scope: 'own' },
    { action: 'delete', entity: 'company', scope: 'own' },
    { action: 'create', entity: 'task', scope: 'own' },
    { action: 'read', entity: 'task', scope: 'own' },
    { action: 'update', entity: 'task', scope: 'own' },
    { action: 'delete', entity: 'task', scope: 'own' },
    { action: 'create', entity: 'meeting', scope: 'own' },
    { action: 'read', entity: 'meeting', scope: 'own' },
    { action: 'update', entity: 'meeting', scope: 'own' },
    { action: 'delete', entity: 'meeting', scope: 'own' },
    { action: 'read', entity: 'team', scope: 'own' },
  ],
  viewer: [
    { action: 'read', entity: 'lead', scope: 'all' },
    { action: 'read', entity: 'contact', scope: 'all' },
    { action: 'read', entity: 'company', scope: 'all' },
    { action: 'read', entity: 'task', scope: 'all' },
    { action: 'read', entity: 'meeting', scope: 'all' },
    { action: 'read', entity: 'analytics', scope: 'all' },
    { action: 'read', entity: 'team', scope: 'all' },
  ],
};

/* ── Permission Check Functions ─────────────────────────────── */

/** Check if a role is allowed to perform a specific action on an entity type. */
export function hasPermission(
  role: TeamRole,
  action: PermissionAction,
  entity: PermissionEntity,
): boolean {
  return ROLE_PERMISSIONS[role].some(
    (p) => p.action === action && p.entity === entity,
  );
}

/**
 * Check if a role can access records of a given entity at the required scope.
 *
 * Access is granted when:
 * - The role has a permission entry for the entity whose scope is `all`
 * - OR the role's scope for the entity matches the required `scope`
 * - OR the required scope is `all` (broadest access)
 */
export function canAccessRecord(
  role: TeamRole,
  entity: PermissionEntity,
  scope: PermissionScope,
): boolean {
  return ROLE_PERMISSIONS[role].some(
    (p) =>
      p.entity === entity &&
      (p.scope === 'all' || p.scope === scope || scope === 'all'),
  );
}

/** Get the full list of permissions granted to a given role. */
export function getRolePermissions(role: TeamRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/** Convenience: check if a role can create records of a given entity type. */
export function canCreate(role: TeamRole, entity: PermissionEntity): boolean {
  return hasPermission(role, 'create', entity);
}

/** Convenience: check if a role can read records of a given entity type. */
export function canRead(role: TeamRole, entity: PermissionEntity): boolean {
  return hasPermission(role, 'read', entity);
}

/** Convenience: check if a role can update records of a given entity type. */
export function canUpdate(role: TeamRole, entity: PermissionEntity): boolean {
  return hasPermission(role, 'update', entity);
}

/** Convenience: check if a role can delete records of a given entity type. */
export function canDelete(role: TeamRole, entity: PermissionEntity): boolean {
  return hasPermission(role, 'delete', entity);
}

/** Check if role is admin (full team management access). */
export function canManageTeamSettings(role: TeamRole): boolean {
  return role === 'admin';
}

/** Check if role can manage team members (add/remove/change roles). */
export function canManageMembers(role: TeamRole): boolean {
  return role === 'admin';
}

/** Check if role can invite new members. */
export function canInviteMembers(role: TeamRole): boolean {
  return role === 'admin';
}
