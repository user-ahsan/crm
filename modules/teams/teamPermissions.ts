import type { TeamRole, Permission, PermissionAction, PermissionEntity, PermissionScope } from '@/types/team.types';

/* ── Role-to-Permission Mapping ─────────────────────────────── */
/*
 * Implements the FEATURES.md feature-21 matrix (extended with a
 * Deals column and a Campaigns column, both documented in
 * .tmp/audit/fixes/PATTERN-rls.md):
 *
 *   | Role    | Leads | Contacts | Companies | Tasks | Meetings | Deals | Campaigns | Team Mgmt | Analytics |
 *   |---------|-------|----------|-----------|-------|----------|-------|-----------|-----------|-----------|
 *   | Admin   | CRUD all | CRUD all | CRUD all | CRUD all | CRUD all | CRUD all | CRUD all | Full    | View |
 *   | Manager | CRUD team | CRUD team | CRUD team | CRUD team | CRUD team | CRUD team | CRUD team | Read members | View |
 *   | Agent   | CRUD own | CRUD own | Read team | CRUD own | CRUD own | CRUD own | CRUD own | Read own | None |
 *   | Viewer  | Read all | Read all | Read all | Read all | Read all | Read all | Read all | Read members | View |
 */

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
    { action: 'create', entity: 'deal', scope: 'all' },
    { action: 'read', entity: 'deal', scope: 'all' },
    { action: 'update', entity: 'deal', scope: 'all' },
    { action: 'delete', entity: 'deal', scope: 'all' },
    { action: 'create', entity: 'campaign', scope: 'all' },
    { action: 'read', entity: 'campaign', scope: 'all' },
    { action: 'update', entity: 'campaign', scope: 'all' },
    { action: 'delete', entity: 'campaign', scope: 'all' },
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
    { action: 'create', entity: 'deal', scope: 'team' },
    { action: 'read', entity: 'deal', scope: 'all' },
    { action: 'update', entity: 'deal', scope: 'team' },
    { action: 'delete', entity: 'deal', scope: 'team' },
    { action: 'create', entity: 'campaign', scope: 'team' },
    { action: 'read', entity: 'campaign', scope: 'all' },
    { action: 'update', entity: 'campaign', scope: 'team' },
    { action: 'delete', entity: 'campaign', scope: 'team' },
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
    // Matrix: Agent Companies = "Read team" — no create/update/delete.
    { action: 'read', entity: 'company', scope: 'team' },
    { action: 'create', entity: 'deal', scope: 'own' },
    { action: 'read', entity: 'deal', scope: 'own' },
    { action: 'update', entity: 'deal', scope: 'own' },
    { action: 'delete', entity: 'deal', scope: 'own' },
    { action: 'create', entity: 'campaign', scope: 'own' },
    { action: 'read', entity: 'campaign', scope: 'own' },
    { action: 'update', entity: 'campaign', scope: 'own' },
    { action: 'delete', entity: 'campaign', scope: 'own' },
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
    { action: 'read', entity: 'deal', scope: 'all' },
    { action: 'read', entity: 'campaign', scope: 'all' },
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
 * Access is granted when the role holds a permission for the entity whose
 * scope is `all`, or whose scope exactly matches the requested `scope`.
 * A request for scope `all` does NOT grant access by itself — the role
 * must actually hold an `all`-scope permission (this fixes the previous
 * inverted logic where any role requesting `'all'` was granted access).
 *
 * Record-ownership enforcement: when both `recordOwnerId` and
 * `currentUserId` are supplied and the requested scope is `own`, access
 * additionally requires the record to belong to the current user.
 * When `recordOwnerId` is omitted, the check is scope-based only.
 *
 * Signature is backward compatible: existing callers pass
 * `(role, entity, scope)` — the extra ids are optional.
 */
export function canAccessRecord(
  role: TeamRole,
  entity: PermissionEntity,
  scope: PermissionScope,
  recordOwnerId?: string,
  currentUserId?: string,
): boolean {
  return ROLE_PERMISSIONS[role].some((p) => {
    if (p.entity !== entity) return false;
    // Broadest access: the role holds an `all`-scope permission for this entity.
    if (p.scope === 'all') return true;
    if (p.scope !== scope) return false;
    // Own-scope request with ownership context: the record must belong to the caller.
    if (scope === 'own' && recordOwnerId !== undefined && currentUserId !== undefined) {
      return recordOwnerId === currentUserId;
    }
    return true;
  });
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
