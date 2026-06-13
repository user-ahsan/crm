'use client';

import type { TeamRole } from '@/types/team.types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
  role: TeamRole;
  size?: 'sm' | 'md' | 'lg';
}

const ROLE_COLORS: Record<TeamRole, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  agent: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-1.5 py-0 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
};

export function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
  const label = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <Badge
      className={cn(
        'font-medium border-0',
        ROLE_COLORS[role],
        SIZE_CLASSES[size],
      )}
      variant="outline"
    >
      {label}
    </Badge>
  );
}

export default RoleBadge;
