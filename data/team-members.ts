import type { TeamMember } from '@/types/team.types';

export const teamMembers: TeamMember[] = [
  {
    id: 'tm-001',
    teamId: 'team-001',
    userId: 'user-1',
    role: 'admin',
    joinedAt: '2026-01-15T08:00:00.000Z',
    user: { name: 'Alice Johnson', email: 'alice@nexuscrm.com' },
  },
  {
    id: 'tm-002',
    teamId: 'team-001',
    userId: 'user-2',
    role: 'manager',
    joinedAt: '2026-01-16T09:00:00.000Z',
    user: { name: 'Bob Smith', email: 'bob@nexuscrm.com' },
  },
  {
    id: 'tm-003',
    teamId: 'team-001',
    userId: 'user-3',
    role: 'agent',
    joinedAt: '2026-01-20T10:00:00.000Z',
    user: { name: 'Carol Williams', email: 'carol@nexuscrm.com' },
  },
  {
    id: 'tm-004',
    teamId: 'team-001',
    userId: 'user-4',
    role: 'agent',
    joinedAt: '2026-02-01T10:00:00.000Z',
    user: { name: 'David Brown', email: 'david@nexuscrm.com' },
  },
  {
    id: 'tm-005',
    teamId: 'team-001',
    userId: 'user-5',
    role: 'viewer',
    joinedAt: '2026-02-10T10:00:00.000Z',
    user: { name: 'Eva Martinez', email: 'eva@nexuscrm.com' },
  },
];
