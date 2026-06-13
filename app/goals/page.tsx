'use client';

import { useState, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useGoals } from '@/hooks/useGoals';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  GOAL_TYPES,
  GOAL_PERIODS,
  GOAL_TYPE_LABELS,
  GOAL_TYPE_ICONS,
  GOAL_PERIOD_LABELS,
  USERS,
} from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { GoalType, GoalPeriod, Goal } from '@/types/goal.types';
import {
  IconPlus,
  IconFlag,
  IconCurrencyDollar,
  IconColumns3,
  IconUsers,
  IconCheckbox,
  IconPhone,
  IconEdit,
  IconTrash,
  IconLoader2,
  IconTarget,
} from '@tabler/icons-react';

const typeIconMap: Record<string, React.ComponentType<{ size?: number; stroke?: number; className?: string }>> = {
  'currency-dollar': IconCurrencyDollar,
  'columns-3': IconColumns3,
  users: IconUsers,
  checkbox: IconCheckbox,
  phone: IconPhone,
  flag: IconFlag,
};

function GoalTypeIcon({ type, className }: { type: GoalType; className?: string }) {
  const iconKey = GOAL_TYPE_ICONS[type] ?? 'flag';
  const Icon = typeIconMap[iconKey] ?? IconFlag;
  return <Icon size={20} stroke={1.5} className={cn('shrink-0', className)} />;
}

const periodColorMap: Record<GoalPeriod, string> = {
  weekly: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  monthly: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
  quarterly: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
  yearly: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
};

export default function GoalsPage() {
  const { goals, loading, error, refresh, create, update, remove, getProgress } = useGoals();
  const { user } = useCurrentUser();
  const [filterPeriod, setFilterPeriod] = useState<GoalPeriod | ''>('');
  const [filterType, setFilterType] = useState<GoalType | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<GoalType>('revenue');
  const [formTarget, setFormTarget] = useState('');
  const [formCurrent, setFormCurrent] = useState('');
  const [formPeriod, setFormPeriod] = useState<GoalPeriod>('monthly');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState('');

  const filtered = useMemo(() => {
    let result = goals;
    if (filterPeriod) result = result.filter((g) => g.period === filterPeriod);
    if (filterType) result = result.filter((g) => g.type === filterType);
    return result;
  }, [goals, filterPeriod, filterType]);

  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormDescription('');
    setFormType('revenue');
    setFormTarget('');
    setFormCurrent('');
    setFormPeriod('monthly');
    setFormStartDate('');
    setFormEndDate('');
    setFormAssignedTo('');
  }, []);

  const populateEditForm = useCallback((goal: Goal) => {
    setFormTitle(goal.title);
    setFormDescription(goal.description);
    setFormType(goal.type);
    setFormTarget(String(goal.target));
    setFormCurrent(String(goal.current));
    setFormPeriod(goal.period);
    setFormStartDate(goal.startDate);
    setFormEndDate(goal.endDate);
    setFormAssignedTo(goal.assignedTo ?? '');
  }, []);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) { toast.error('Title is required'); return; }
    if (!formStartDate) { toast.error('Start date is required'); return; }
    if (!formEndDate) { toast.error('End date is required'); return; }
    setSubmitting(true);
    try {
      const data = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        type: formType,
        target: formTarget ? Number(formTarget) : 0,
        current: formCurrent ? Number(formCurrent) : 0,
        period: formPeriod,
        start_date: formStartDate,
        end_date: formEndDate,
        assigned_to: formAssignedTo || null,
      };
      const result = await create(data);
      if (result) {
        toast.success('Goal created');
        setCreateOpen(false);
        resetForm();
      } else {
        toast.error('Failed to create goal');
      }
    } catch {
      toast.error('Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  }, [formTitle, formDescription, formType, formTarget, formCurrent, formPeriod, formStartDate, formEndDate, formAssignedTo, create, resetForm]);

  const handleUpdate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGoal) return;
    if (!formTitle.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    try {
      const result = await update(editGoal.id, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        type: formType,
        target: formTarget ? Number(formTarget) : 0,
        current: formCurrent ? Number(formCurrent) : 0,
        period: formPeriod,
        start_date: formStartDate,
        end_date: formEndDate,
        assigned_to: formAssignedTo || null,
      });
      if (result) {
        toast.success('Goal updated');
        setEditGoal(null);
        resetForm();
      } else {
        toast.error('Failed to update goal');
      }
    } catch {
      toast.error('Failed to update goal');
    } finally {
      setSubmitting(false);
    }
  }, [editGoal, formTitle, formDescription, formType, formTarget, formCurrent, formPeriod, formStartDate, formEndDate, formAssignedTo, update, resetForm]);

  const handleDelete = useCallback(async (goal: Goal) => {
    if (!window.confirm(`Delete goal "${goal.title}"?`)) return;
    await remove(goal.id);
    toast.success('Goal deleted');
  }, [remove]);

  const openEdit = useCallback((goal: Goal) => {
    populateEditForm(goal);
    setEditGoal(goal);
  }, [populateEditForm]);

  const handleCreateOpenChange = useCallback((open: boolean) => {
    if (!open) resetForm();
    setCreateOpen(open);
  }, [resetForm]);

  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) {
      resetForm();
      setEditGoal(null);
    }
  }, [resetForm]);

  // Loading
  if (loading && goals.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
            <div className="mt-1 h-4 w-48 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
        </div>
        <LoadingSkeleton type="card" count={6} />
      </div>
    );
  }

  // Error
  if (error && goals.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Goals" />
        <ErrorState title="Failed to load goals" message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Goals"
        description={loading ? undefined : `${goals.length} goal${goals.length !== 1 ? 's' : ''}`}
      >
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} />
            New Goal
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground shrink-0">Period</Label>
          <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as GoalPeriod | '')}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {GOAL_PERIODS.map((p) => (
                <SelectItem key={p} value={p}>{GOAL_PERIOD_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground shrink-0">Type</Label>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as GoalType | '')}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {GOAL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{GOAL_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(filterPeriod || filterType) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterPeriod(''); setFilterType(''); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={<IconTarget size={48} stroke={1.5} />}
          title={goals.length === 0 ? 'No goals yet' : 'No goals match the filter'}
          description={
            goals.length === 0
              ? 'Set targets to track your team performance'
              : 'Try adjusting the filters'
          }
          action={goals.length === 0 ? { label: 'Create Goal', onClick: () => setCreateOpen(true) } : undefined}
        />
      )}

      {/* Goal Cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((goal) => {
            const progress = getProgress(goal);
            return (
              <Card key={goal.id} className="flex flex-col">
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5">
                      <GoalTypeIcon type={goal.type} className="text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{goal.title}</h3>
                      {goal.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{goal.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(goal)}>
                      <IconEdit size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => handleDelete(goal)}>
                      <IconTrash size={14} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 pb-3">
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className={cn(
                        'font-medium',
                        progress >= 100 ? 'text-green-600 dark:text-green-400' : progress >= 50 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                      )}>
                        {progress}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-muted-foreground'
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Target vs Current */}
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-muted-foreground">Current: </span>
                      <span className="font-medium">{goal.current.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Target: </span>
                      <span className="font-medium">{goal.target.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">{GOAL_TYPE_LABELS[goal.type]}</Badge>
                    <Badge className={cn('text-xs', periodColorMap[goal.period])}>
                      {GOAL_PERIOD_LABELS[goal.period]}
                    </Badge>
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-3 text-xs text-muted-foreground">
                  {goal.startDate} — {goal.endDate}
                  {goal.assignedTo && (
                    <span className="ml-auto truncate max-w-[120px]">
                      {USERS.find((u) => u.id === goal.assignedTo)?.name ?? goal.assignedTo}
                    </span>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Goal</DialogTitle>
            <DialogDescription>Set a new performance target for your team</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-title">Title <span className="text-destructive">*</span></Label>
              <Input id="goal-title" placeholder="Monthly revenue target" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} disabled={submitting} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-desc">Description</Label>
              <Textarea id="goal-desc" placeholder="Optional details" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} disabled={submitting} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as GoalType)} disabled={submitting}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{GOAL_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Period</Label>
                <Select value={formPeriod} onValueChange={(v) => setFormPeriod(v as GoalPeriod)} disabled={submitting}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>{GOAL_PERIOD_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-target">Target</Label>
                <Input id="goal-target" type="number" min="0" placeholder="100000" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} disabled={submitting} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-current">Current</Label>
                <Input id="goal-current" type="number" min="0" placeholder="0" value={formCurrent} onChange={(e) => setFormCurrent(e.target.value)} disabled={submitting} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-start">Start Date <span className="text-destructive">*</span></Label>
                <Input id="goal-start" type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} disabled={submitting} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-end">End Date <span className="text-destructive">*</span></Label>
                <Input id="goal-end" type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} disabled={submitting} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Assigned to</Label>
              <Select value={formAssignedTo} onValueChange={(v) => { if (v !== null) setFormAssignedTo(v); }} disabled={submitting}>
                <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                <SelectContent>
                  {USERS.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <IconLoader2 size={14} className="animate-spin" />}
                {submitting ? 'Creating...' : 'Create Goal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editGoal} onOpenChange={handleEditOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
            <DialogDescription>Update goal details or progress</DialogDescription>
          </DialogHeader>
          {editGoal && (
            <form onSubmit={handleUpdate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-title">Title <span className="text-destructive">*</span></Label>
                <Input id="edit-title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} disabled={submitting} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} disabled={submitting} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={(v) => setFormType(v as GoalType)} disabled={submitting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GOAL_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{GOAL_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Period</Label>
                  <Select value={formPeriod} onValueChange={(v) => setFormPeriod(v as GoalPeriod)} disabled={submitting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GOAL_PERIODS.map((p) => (
                        <SelectItem key={p} value={p}>{GOAL_PERIOD_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-target">Target</Label>
                  <Input id="edit-target" type="number" min="0" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} disabled={submitting} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-current">Current</Label>
                  <Input id="edit-current" type="number" min="0" value={formCurrent} onChange={(e) => setFormCurrent(e.target.value)} disabled={submitting} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-start">Start Date</Label>
                  <Input id="edit-start" type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} disabled={submitting} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-end">End Date</Label>
                  <Input id="edit-end" type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} disabled={submitting} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Assigned to</Label>
                <Select value={formAssignedTo} onValueChange={(v) => { if (v !== null) setFormAssignedTo(v); }} disabled={submitting}>
                  <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                  <SelectContent>
                    {USERS.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" type="button" onClick={() => setEditGoal(null)} disabled={submitting}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <IconLoader2 size={14} className="animate-spin" />}
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
