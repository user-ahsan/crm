/* ── Team Types ─────────────────────────────────────────────── */

export type TeamRole = 'admin' | 'manager' | 'agent' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type PermissionAction = 'create' | 'read' | 'update' | 'delete';
export type PermissionEntity = 'lead' | 'contact' | 'company' | 'task' | 'meeting' | 'team' | 'analytics';
export type PermissionScope = 'own' | 'team' | 'all';

/* ── Entity Interfaces ─────────────────────────────────────── */

export interface Team {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  /** Populated on read with user details */
  user?: { name: string; email: string; avatar?: string };
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface Permission {
  action: PermissionAction;
  entity: PermissionEntity;
  scope: PermissionScope;
}

/* ── Form Data Interfaces ───────────────────────────────────── */

export interface TeamFormData {
  name: string;
  description?: string;
}

export interface InviteMemberFormData {
  email: string;
  role: TeamRole;
}
