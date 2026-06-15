'use client';

import type { ReactNode } from 'react';
import type { Activity } from '@/types/activity.types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/formatters';
import {
  IconMail,
  IconCalendar,
  IconCheck,
  IconPlus,
  IconEdit,
  IconTrash,
  IconArrowRight,
} from '@tabler/icons-react';

interface ActivityTimelineProps {
  activities: Activity[];
  className?: string;
  maxHeight?: string;
}

function getActivityIcon(type: Activity['type']): ReactNode {
  switch (type) {
    case 'communication_logged':
      return <IconMail size={16} />;
    case 'meeting_scheduled':
      return <IconCalendar size={16} />;
    case 'meeting_completed':
      return <IconCheck size={16} />;
    case 'task_completed':
      return <IconCheck size={16} />;
    case 'created':
    case 'task_created':
      return <IconPlus size={16} />;
    case 'updated':
    case 'note_added':
      return <IconEdit size={16} />;
    case 'deleted':
      return <IconTrash size={16} />;
    case 'status_changed':
    case 'assigned':
      return <IconArrowRight size={16} />;
    default:
      return <IconEdit size={16} />;
  }
}

function getActivityColor(type: Activity['type']): string {
  switch (type) {
    case 'communication_logged':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300';
    case 'meeting_scheduled':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300';
    case 'meeting_completed':
    case 'task_completed':
      return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300';
    case 'created':
    case 'task_created':
      return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300';
    case 'updated':
    case 'note_added':
      return 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300';
    case 'deleted':
      return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300';
    case 'status_changed':
    case 'assigned':
      return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  }
}

export function ActivityTimeline({
  activities,
  className,
  maxHeight = '400px',
}: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <ScrollArea className={cn('', className)} style={{ maxHeight }}>
      <div className="space-y-0">
        {activities.map((activity, index) => (
          <div key={activity.id} className="relative flex gap-4 pb-6">
            {/* Vertical connector line */}
            {index < activities.length - 1 && (
              <div className="absolute left-[19px] top-10 h-full w-px bg-border" />
            )}

            {/* Icon */}
            <div
              className={cn(
                'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                getActivityColor(activity.type),
              )}
            >
              {getActivityIcon(activity.type)}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-1 pt-1">
              <p className="text-sm">{activity.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(activity.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export default ActivityTimeline;
