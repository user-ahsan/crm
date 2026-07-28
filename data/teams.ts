/**
 * MOCK DATA — Used for development/demo only.
 * Production data comes from Supabase via services/*.service.ts
 */
import type { Team } from '@/types/team.types';

export const teams: Team[] = [
  {
    id: 'team-001',
    name: 'NexusCRM Sales Team',
    description: 'Primary sales team handling all inbound leads',
    createdBy: 'user-1',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-01-15T08:00:00Z',
  },
];
