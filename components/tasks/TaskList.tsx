'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Task } from '@/types/task.types';
import { useTasks } from '@/hooks/useTasks';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TASK_PRIORITY_COLORS } from '@/lib/color-tokens';
import { formatRelativeTime, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconList,
  IconRefresh,
  IconAlertTriangle,
} from '@tabler/icons-react';

interface TaskListProps {
  tasks?: Task[];
  showEntity?: boolean;
  onTaskUpdate?: () => void;
}

type FilterTab = 'all' | 'pending' | 'completed' | 'overdue';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' },
];

function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.status === 'completed') return false;
  if (!task.dueDate) return false;
  return new Date(task.dueDate) < now;
}

function filterTasksByTab(tasks: Task[], tab: FilterTab, now: Date): Task[] {
  switch (tab) {
    case 'all':
      return tasks;
    case 'pending':
      return tasks.filter((t) => t.status === 'pending');
    case 'completed':
      return tasks.filter((t) => t.status === 'completed');
    case 'overdue':
      return tasks.filter((t) => t.status === 'overdue' || isOverdue(t, now));
    default:
      return tasks;
  }
}

function TaskRow({
  task,
  onToggle,
  showEntity,
  now,
}: {
  task: Task;
  onToggle: (id: string) => void;
  showEntity?: boolean;
  now: Date;
}) {
  const taskIsOverdue = isOverdue(task, now);
  const isCompleted = task.status === 'completed';

  const handleCheckedChange = useCallback(
    () => {
      onToggle(task.id);
    },
    [task.id, onToggle]
  );

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
        'hover:bg-muted/50',
        isCompleted && 'opacity-60',
        taskIsOverdue && 'bg-red-50 dark:bg-red-950/20'
      )}
    >
      {/* Checkbox toggle */}
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleCheckedChange}
        aria-label={`Mark "${task.title}" as ${isCompleted ? 'pending' : 'completed'}`}
      />

      {/* Title */}
      <span
        className={cn(
          'flex-1 text-sm min-w-0 truncate',
          isCompleted && 'line-through text-muted-foreground',
          taskIsOverdue && !isCompleted && 'text-destructive font-medium'
        )}
      >
        {task.title}
      </span>

      {/* Entity reference */}
      {showEntity && task.relatedToType && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
          {task.relatedToType}
        </Badge>
      )}

      {/* Priority badge */}
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] px-1.5 py-0 flex-shrink-0',
          TASK_PRIORITY_COLORS[task.priority]
        )}
      >
        {task.priority}
      </Badge>

      {/* Due date */}
      {task.dueDate && (
        <span
          className={cn(
            'text-xs flex-shrink-0 flex items-center gap-1',
            taskIsOverdue && !isCompleted
              ? 'text-destructive font-semibold'
              : 'text-muted-foreground'
          )}
        >
          {taskIsOverdue && !isCompleted ? (
            <IconAlertCircle size={12} className="flex-shrink-0" />
          ) : (
            <IconClock size={12} className="flex-shrink-0" />
          )}
          <span className="hidden sm:inline">{formatDate(task.dueDate)}</span>
          <span className="sm:hidden">{formatRelativeTime(task.dueDate)}</span>
        </span>
      )}

      {/* Overdue tag for mobile */}
      {taskIsOverdue && !isCompleted && (
        <Badge
          variant="destructive"
          className="text-[10px] px-1.5 py-0 sm:hidden"
        >
          Overdue
        </Badge>
      )}
    </div>
  );
}

export function TaskList({ tasks: externalTasks, showEntity, onTaskUpdate }: TaskListProps) {
  const {
    tasks: hookTasks,
    loading,
    error,
    refresh,
    toggleTask,
  } = useTasks();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [now] = useState(() => new Date());

  const sourceTasks = externalTasks ?? hookTasks;

  const filteredTasks = useMemo(
    () => filterTasksByTab(sourceTasks, activeTab, now),
    [sourceTasks, activeTab, now]
  );

  const handleToggle = useCallback(
    async (id: string) => {
      const result = await toggleTask(id);
      if (result) {
        onTaskUpdate?.();
      }
    },
    [toggleTask, onTaskUpdate]
  );

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <div className="size-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <IconAlertTriangle size={20} className="text-destructive" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Failed to load tasks</p>
          <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <IconRefresh size={14} />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      {!externalTasks && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tasks</h3>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh tasks"
          >
            <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      )}

      {/* Filter tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as FilterTab)}
      >
        <TabsList className="w-full">
          {FILTER_TABS.map((tab) => {
            const count = tab.key === 'all'
              ? sourceTasks.length
              : filterTasksByTab(sourceTasks, tab.key, now).length;
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="flex-1 text-xs">
                {tab.label}
                <span className="ml-1 text-[10px] opacity-60">({count})</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Content per tab */}
        {FILTER_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-0">
            {/* Loading state */}
            {loading ? (
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : filteredTasks.length > 0 ? (
              /* Task list */
              <div className="flex flex-col gap-0.5">
                {filteredTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    showEntity={showEntity}
                    now={now}
                  />
                ))}
              </div>
            ) : (
              /* Empty state per filter */
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                  {tab.key === 'completed' ? (
                    <IconCheck size={16} className="text-muted-foreground" />
                  ) : tab.key === 'overdue' ? (
                    <IconAlertCircle size={16} className="text-muted-foreground" />
                  ) : (
                    <IconList size={16} className="text-muted-foreground" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    {tab.key === 'all' && 'No tasks yet'}
                    {tab.key === 'pending' && 'No pending tasks'}
                    {tab.key === 'completed' && 'No completed tasks'}
                    {tab.key === 'overdue' && 'No overdue tasks — great job!'}
                  </p>
                  {tab.key === 'all' && (
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      Create a task to get started
                    </p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
