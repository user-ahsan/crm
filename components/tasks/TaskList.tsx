'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Task, TaskPriority } from '@/types/task.types';
import { useTasks } from '@/hooks/useTasks';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TASK_PRIORITY_COLORS } from '@/lib/color-tokens';
import { formatRelativeTime, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconList,
  IconRefresh,
  IconAlertTriangle,
  IconEdit,
  IconTrash,
  IconFilter,
  IconSortAscending,
} from '@tabler/icons-react';

interface TaskListProps {
  tasks?: Task[];
  showEntity?: boolean;
  onTaskUpdate?: () => void;
  /** Callback to open the edit form for a task. */
  onEditTask?: (task: Task) => void;
}

type FilterTab = 'all' | 'pending' | 'completed' | 'overdue';
type SortKey = 'dueDate' | 'priority' | 'createdAt';
type SortDir = 'asc' | 'desc';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const ASSIGNEE_OPTIONS = [
  { value: 'all', label: 'All Assignees' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'user-1', label: 'Alice Johnson' },
  { value: 'user-2', label: 'Bob Smith' },
  { value: 'user-3', label: 'Carol Williams' },
  { value: 'user-4', label: 'David Brown' },
  { value: 'user-5', label: 'Eva Martinez' },
];

const ENTITY_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'lead', label: 'Lead' },
  { value: 'contact', label: 'Contact' },
  { value: 'company', label: 'Company' },
];

const SORT_OPTIONS = [
  { value: 'dueDate', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'createdAt', label: 'Created Date' },
];

function isOverdue(task: Task, now: Date): boolean {
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

function applyFilters(
  tasks: Task[],
  priorityFilter: string,
  assigneeFilter: string,
  entityTypeFilter: string,
): Task[] {
  let result = tasks;
  if (priorityFilter !== 'all') {
    result = result.filter((t) => t.priority === priorityFilter);
  }
  if (assigneeFilter !== 'all') {
    if (assigneeFilter === 'unassigned') {
      result = result.filter((t) => !t.assignedTo);
    } else {
      result = result.filter((t) => t.assignedTo === assigneeFilter);
    }
  }
  if (entityTypeFilter !== 'all') {
    result = result.filter((t) => t.relatedToType === entityTypeFilter);
  }
  return result;
}

function sortTaskList(tasks: Task[], by: SortKey, dir: SortDir): Task[] {
  const priorityOrder: Record<TaskPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    if (by === 'priority') {
      cmp = (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0);
    } else if (by === 'dueDate') {
      if (!a.dueDate) cmp = 1;
      else if (!b.dueDate) cmp = -1;
      else cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    } else {
      cmp = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  showEntity,
  now,
}: {
  task: Task;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
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

      {/* Edit + Delete actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onEdit(task)}
          aria-label={`Edit "${task.title}"`}
        >
          <IconEdit size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onDelete(task)}
          aria-label={`Delete "${task.title}"`}
          className="text-muted-foreground hover:text-destructive"
        >
          <IconTrash size={14} />
        </Button>
      </div>
    </div>
  );
}

export function TaskList({ tasks: externalTasks, showEntity, onTaskUpdate, onEditTask }: TaskListProps) {
  const {
    tasks: hookTasks,
    loading,
    error,
    refresh,
    toggleTask,
    deleteTask,
  } = useTasks();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  // Live clock: recompute `now` every 60s so overdue highlighting updates in real time.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Filter + sort state
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Delete confirmation state
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sourceTasks = externalTasks ?? hookTasks;

  const filteredTasks = useMemo(() => {
    const tabFiltered = filterTasksByTab(sourceTasks, activeTab, now);
    const extraFiltered = applyFilters(tabFiltered, priorityFilter, assigneeFilter, entityTypeFilter);
    return sortTaskList(extraFiltered, sortKey, sortDir);
  }, [sourceTasks, activeTab, now, priorityFilter, assigneeFilter, entityTypeFilter, sortKey, sortDir]);

  const handleToggle = useCallback(
    async (id: string) => {
      const result = await toggleTask(id);
      if (result) {
        onTaskUpdate?.();
      } else {
        // Toggle failed — surface as a toast, NOT the load-error screen.
        // The hook sets its error state, but a toggle failure should not blank the whole list.
        toast.error('Failed to update task status. Please try again.');
      }
    },
    [toggleTask, onTaskUpdate]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingTask) return;
    setDeleteError(null);
    const success = await deleteTask(deletingTask.id);
    if (success) {
      toast.success(`Task "${deletingTask.title}" deleted`);
      setDeletingTask(null);
      onTaskUpdate?.();
    } else {
      setDeleteError('Failed to delete task. Please try again.');
    }
  }, [deletingTask, deleteTask, onTaskUpdate]);

  // Error state — only show for load failures, not toggle failures.
  // Toggle failures are surfaced as toasts (see handleToggle).
  if (error && !externalTasks && sourceTasks.length === 0) {
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
            {/* Filters + Sort row */}
            <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
              <IconFilter size={14} className="text-muted-foreground flex-shrink-0" />
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-7 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="h-7 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNEE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="h-7 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mx-1 h-4 w-px bg-border" />
              <IconSortAscending size={14} className="text-muted-foreground flex-shrink-0" />
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="h-7 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
              >
                {sortDir === 'asc' ? '↑' : '↓'}
              </Button>
            </div>

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
                    onEdit={(t) => onEditTask?.(t)}
                    onDelete={(t) => {
                      setDeletingTask(t);
                      setDeleteError(null);
                    }}
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

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deletingTask}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingTask(null);
            setDeleteError(null);
          }
        }}
        title="Delete Task"
        description={`Are you sure you want to delete "${deletingTask?.title ?? ''}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Delete"
        variant="destructive"
        error={deleteError}
      />
    </div>
  );
}
