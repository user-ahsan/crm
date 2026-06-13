import type { TeamInvitation } from '@/types/team.types';

export const teamInvitations: TeamInvitation[] = [
  {
    id: 'inv-001',
    teamId: 'team-001',
    email: 'frank.wilson@example.com',
    role: 'agent',
    invitedBy: 'user-1',
    status: 'pending',
    expiresAt: '2026-06-20T12:00:00.000Z',
    createdAt: '2026-06-13T12:00:00.000Z',
  },
  {
    id: 'inv-002',
    teamId: 'team-001',
    email: 'grace.lee@example.com',
    role: 'viewer',
    invitedBy: 'user-1',
    status: 'expired',
    expiresAt: '2026-05-01T12:00:00.000Z',
    createdAt: '2026-04-24T12:00:00.000Z',
  },
];
