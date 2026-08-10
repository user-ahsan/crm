/**
 * MOCK DATA — Development/demo user directory.
 * Live user data comes from Supabase auth + the team service (types/team.types.ts).
 *
 * This canonical demo list mirrors data/team-members.ts (user-1..user-5 with matching
 * names/emails/roles) so every mock record that references an assignee or creator
 * (leads, deals, tasks, activities, notes, invoices, quotes, campaigns) resolves to a
 * real display user. Components resolve names via lib/user-utils.ts and attribute live
 * actions via hooks/useCurrentUser.ts — never by hardcoding a user id.
 */
import type { TeamRole } from '@/types/team.types';

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  initials: string;
  /** Tailwind background class used for avatars and presence dots */
  color: string;
  active: boolean;
}

export const USERS: MockUser[] = [
  {
    id: 'user-1',
    name: 'Alice Johnson',
    email: 'alice@nexuscrm.com',
    role: 'admin',
    initials: 'AJ',
    color: 'bg-blue-500',
    active: true,
  },
  {
    id: 'user-2',
    name: 'Bob Smith',
    email: 'bob@nexuscrm.com',
    role: 'manager',
    initials: 'BS',
    color: 'bg-green-500',
    active: true,
  },
  {
    id: 'user-3',
    name: 'Carol Williams',
    email: 'carol@nexuscrm.com',
    role: 'agent',
    initials: 'CW',
    color: 'bg-purple-500',
    active: true,
  },
  {
    id: 'user-4',
    name: 'David Brown',
    email: 'david@nexuscrm.com',
    role: 'agent',
    initials: 'DB',
    color: 'bg-amber-500',
    active: true,
  },
  {
    id: 'user-5',
    name: 'Eva Martinez',
    email: 'eva@nexuscrm.com',
    role: 'viewer',
    initials: 'EM',
    color: 'bg-orange-500',
    active: true,
  },
];
