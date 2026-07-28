'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { WorkflowStateCard } from '@/components/workflow/WorkflowStateCard';
import { WorkflowTransitionLine } from '@/components/workflow/WorkflowTransitionLine';
import { useWorkflowEditor } from '@/hooks/useWorkflowEditor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { WorkflowEntityType } from '@/types/workflow.types';
import {
  IconHierarchy,
  IconPlus,
  IconSwitchHorizontal,
  IconX,
  IconArrowUp,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

/* ── Predefined palette for new state ──────────────────── */
const ADD_COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
  '#84cc16', '#eab308', '#f97316', '#ef4444',
];

interface WorkflowEditorProps {
  entityType: WorkflowEntityType;
}

export function WorkflowEditor({ entityType }: WorkflowEditorProps) {
  const {
    states,
    loading,
    error,
    refresh,
    createState,
    updateState,
    getOutgoingTransitions,
    createTransition,
    deleteTransition,
    /* Connection drawing */
    connectSourceId,
    isConnecting,
    startConnecting,
    cancelConnecting,
    completeConnection,
    /* Delete confirmation */
    deletingId,
    requestDelete,
    cancelDelete,
    confirmDelete,
    /* Drag-and-drop */
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
    /* Color picker */
  } = useWorkflowEditor(entityType);

  const { user: currentUser } = useCurrentUser();

  /* ── Add state inline form ───────────────────────────── */
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStateName, setNewStateName] = useState('');
  const [newStateColor, setNewStateColor] = useState('#6366f1');
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAddForm && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [showAddForm]);

  const handleAddState = useCallback(async () => {
    const trimmed = newStateName.trim();
    if (!trimmed || !currentUser?.id) return;
    const result = await createState({
      name: trimmed,
      color: newStateColor,
      entityType,
    });
    if (result) {
      toast.success(`State "${trimmed}" created`);
      setNewStateName('');
      setShowAddForm(false);
    } else {
      toast.error('Failed to create state');
    }
  }, [newStateName, newStateColor, entityType, createState, currentUser]);

  const handleAddKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleAddState();
      if (e.key === 'Escape') {
        setShowAddForm(false);
        setNewStateName('');
      }
    },
    [handleAddState],
  );

  /* ── Edit state handlers ─────────────────────────────── */
  const handleEditName = useCallback(
    async (id: string, name: string) => {
      const result = await updateState(id, { name });
      if (result) toast.success('State renamed');
      else toast.error('Failed to rename state');
    },
    [updateState],
  );

  const handleEditColor = useCallback(
    async (id: string, color: string) => {
      const result = await updateState(id, { color });
      if (!result) toast.error('Failed to update color');
    },
    [updateState],
  );

  /* ── Transition management ───────────────────────────── */
  const [showTransitionForm, setShowTransitionForm] = useState(false);
  const [transFrom, setTransFrom] = useState('');
  const [transTo, setTransTo] = useState('');
  const [transLabel, setTransLabel] = useState('');

  const handleAddTransition = useCallback(async () => {
    if (!transFrom || !transTo) return;
    if (transFrom === transTo) {
      toast.error('Cannot create a self-transition');
      return;
    }
    const result = await createTransition({
      fromStateId: transFrom,
      toStateId: transTo,
      label: transLabel,
    });
    if (result) {
      toast.success('Transition created');
      setTransFrom('');
      setTransTo('');
      setTransLabel('');
      setShowTransitionForm(false);
    } else {
      toast.error('Failed to create transition');
    }
  }, [transFrom, transTo, transLabel, createTransition]);

  const handleDeleteTransition = useCallback(
    async (id: string) => {
      const ok = await deleteTransition(id);
      if (ok) toast.success('Transition removed');
      else toast.error('Failed to remove transition');
    },
    [deleteTransition],
  );

  /* ── Connection drawing via state cards ──────────────── */
  const handleStateCardConnect = useCallback(
    async (sourceId: string) => {
      if (isConnecting) {
        /* Already in connect mode — clicking another card completes it */
        return;
      }
      startConnecting(sourceId);
    },
    [isConnecting, startConnecting],
  );

  const handleStateCardCompleteConnect = useCallback(
    async (targetId: string) => {
      if (connectSourceId && connectSourceId !== targetId) {
        const result = await completeConnection(targetId);
        if (result) {
          const fromName =
            states.find((s) => s.id === connectSourceId)?.name ?? '?';
          const toName = states.find((s) => s.id === targetId)?.name ?? '?';
          toast.success(`Transition created: ${fromName} → ${toName}`);
        } else {
          toast.error('Failed to create transition');
        }
      } else {
        cancelConnecting();
      }
    },
    [connectSourceId, states, completeConnection, cancelConnecting],
  );

  /* ── Delete confirmation ─────────────────────────────── */
  const handleConfirmDelete = useCallback(async () => {
    const ok = await confirmDelete();
    if (ok) toast.success('State deleted');
    else toast.error('Failed to delete state');
  }, [confirmDelete]);

  /* ── Transition count (for badge) ──────────────────── */
  const transitionCount = states.reduce(
    (sum, s) => sum + getOutgoingTransitions(s.id).length,
    0,
  );

  /* ── Loading state ───────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton for horizontal card lane */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex w-48 shrink-0 flex-col gap-3 rounded-xl border p-3"
            >
              <Skeleton className="h-1.5 w-full rounded-t-xl" />
              <div className="flex items-center gap-2">
                <Skeleton className="size-3 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
        {/* Skeleton for transitions */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  /* ── Error state ─────────────────────────────────────── */
  if (error) {
    return (
      <ErrorState
        title="Failed to load workflow"
        message={error}
        onRetry={refresh}
      />
    );
  }

  /* ── Transition count alias for badge ───────────────── */
  const filteredTransitions = transitionCount;

  /* ── Empty state ─────────────────────────────────────── */
  if (states.length === 0 && !showAddForm) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<IconHierarchy size={48} stroke={1.5} />}
          title="No states defined"
          description="Create your first workflow state to start building the pipeline."
          action={{
            label: 'Add your first state',
            onClick: () => setShowAddForm(true),
          }}
        />

        {/* Inline add form when triggered */}
        {showAddForm && (
          <AddStateForm
            value={newStateName}
            onChange={setNewStateName}
            color={newStateColor}
            onColorChange={setNewStateColor}
            onSubmit={handleAddState}
            onCancel={() => {
              setShowAddForm(false);
              setNewStateName('');
            }}
            inputRef={addInputRef}
            onKeyDown={handleAddKeyDown}
          />
        )}
      </div>
    );
  }

  /* ── Connect mode indicator ──────────────────────────── */
  const connectSourceName = connectSourceId
    ? states.find((s) => s.id === connectSourceId)?.name ?? ''
    : '';

  return (
    <div className="space-y-6">
      {/* Connect mode banner */}
      {isConnecting && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <IconArrowUp size={16} className="text-primary" />
          <span>
            Click on a <strong>target state</strong> to create a transition
            from{' '}
            <Badge variant="secondary" className="mx-1 text-xs">
              {connectSourceName}
            </Badge>
            .
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs"
            onClick={cancelConnecting}
          >
            <IconX size={12} className="mr-1" />
            Cancel
          </Button>
        </div>
      )}

      {/* State cards lane */}
      <Card className="overflow-hidden">
        <div className="border-b border-border/50 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              States
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {states.length}
              </Badge>
            </h3>
          </div>
        </div>

        <div className="p-4">
          <div
            className="flex gap-3 overflow-x-auto pb-2 [mask-image:linear-gradient(to_right,black_0%,black_95%,transparent_100%)]"
            role="list"
            aria-label="Workflow states"
          >
            {states.map((state, index) => {
              const outgoing = getOutgoingTransitions(state.id);
              return (
                <WorkflowStateCard
                  key={state.id}
                  state={state}
                  index={index}
                  isDragging={false}
                  dragIndex={null}
                  isConnectSource={connectSourceId === state.id}
                  isConnecting={isConnecting}
                  outgoingTransitions={outgoing}
                  allStates={states}
                  onEditName={handleEditName}
                  onEditColor={handleEditColor}
                  onDelete={requestDelete}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                  onStartConnect={handleStateCardConnect}
                  onCompleteConnect={handleStateCardCompleteConnect}
                />
              );
            })}

            {/* Add state card */}
            {showAddForm ? (
              <div className="flex w-48 shrink-0 flex-col gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {/* Color dot */}
                    <Popover>
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            className="size-3 shrink-0 rounded-full ring-offset-2 ring-offset-background hover:ring-2 hover:ring-ring"
                            style={{ backgroundColor: newStateColor }}
                            aria-label="Pick color"
                          />
                        }
                      />
                      <PopoverContent
                        side="bottom"
                        align="start"
                        className="w-48 p-3"
                      >
                        <div className="grid grid-cols-4 gap-2">
                          {ADD_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              className={cn(
                                'size-7 rounded-full ring-offset-2 ring-offset-background transition-all hover:scale-110',
                                newStateColor === c &&
                                  'ring-2 ring-ring scale-110',
                              )}
                              style={{ backgroundColor: c }}
                              onClick={() => setNewStateColor(c)}
                              aria-label={`Color ${c}`}
                            />
                          ))}
                        </div>
                        <div className="mt-2 flex items-center gap-2 border-t pt-2">
                          <Input
                            type="color"
                            value={newStateColor}
                            onChange={(e) =>
                              setNewStateColor(e.target.value)
                            }
                            className="size-7 w-12 cursor-pointer p-0.5"
                            aria-label="Custom color"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Input
                      ref={addInputRef}
                      value={newStateName}
                      onChange={(e) => setNewStateName(e.target.value)}
                      onKeyDown={handleAddKeyDown}
                      placeholder="State name"
                      className="h-7 text-xs flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={handleAddState}
                      disabled={!newStateName.trim()}
                    >
                      <IconPlus size={12} className="mr-1" />
                      Add
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewStateName('');
                      }}
                    >
                      <IconX size={12} />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex w-48 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary hover:bg-primary/5"
              >
                <IconPlus size={16} />
                Add State
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Transitions section */}
      <Card>
        <div className="border-b border-border/50 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Transitions
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {filteredTransitions}
              </Badge>
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowTransitionForm((p) => !p)}
            >
              {showTransitionForm ? (
                <>
                  <IconX size={12} className="mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <IconSwitchHorizontal size={12} className="mr-1" />
                  Add Transition
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Add transition form */}
          {showTransitionForm && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">
                  From
                </label>
                <Select value={transFrom} onValueChange={(v) => v && setTransFrom(v)}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">
                  To
                </label>
                <Select value={transTo} onValueChange={(v) => v && setTransTo(v)}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">
                  Label
                </label>
                <Input
                  placeholder="e.g. Approve"
                  value={transLabel}
                  onChange={(e) => setTransLabel(e.target.value)}
                  className="h-8 w-28 text-xs"
                />
              </div>

              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleAddTransition}
                disabled={!transFrom || !transTo}
              >
                <IconPlus size={12} className="mr-1" />
                Create
              </Button>
            </div>
          )}

          {/* Transition list */}
          {states.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Add states before creating transitions.
            </p>
          ) : (
            <>
              {states
                .flatMap((s) => {
                  const outgoing = getOutgoingTransitions(s.id);
                  return outgoing.map((t) => {
                    const toState = states.find(
                      (st) => st.id === t.toStateId,
                    );
                    return { transition: t, fromState: s, toState };
                  });
                })
                .map(({ transition, fromState, toState }) => (
                  <WorkflowTransitionLine
                    key={transition.id}
                    transition={transition}
                    fromState={fromState}
                    toState={toState}
                    onDelete={handleDeleteTransition}
                  />
                ))}

              {states.length > 0 &&
                states.every(
                  (s) => getOutgoingTransitions(s.id).length === 0,
                ) && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No transitions yet. Click the{' '}
                    <strong className="font-medium">link icon</strong> on a
                    state card or use the form above.
                  </p>
                )}
            </>
          )}
        </div>
      </Card>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) cancelDelete();
        }}
        title="Delete State"
        description="Are you sure you want to delete this state? All transitions to and from this state will also be removed. This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}

/* ── Inline add-state form (reused in empty state) ────── */
interface AddStateFormProps {
  value: string;
  onChange: (v: string) => void;
  color: string;
  onColorChange: (c: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function AddStateForm({
  value,
  onChange,
  color,
  onColorChange,
  onSubmit,
  onCancel,
  inputRef,
  onKeyDown,
}: AddStateFormProps) {
  return (
    <Card className="mx-auto max-w-md p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="size-4 shrink-0 rounded-full ring-offset-2 ring-offset-background hover:ring-2 hover:ring-ring"
                  style={{ backgroundColor: color }}
                  aria-label="Pick color"
                />
              }
            />
            <PopoverContent side="bottom" align="start" className="w-48 p-3">
              <div className="grid grid-cols-4 gap-2">
                {ADD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      'size-7 rounded-full ring-offset-2 ring-offset-background transition-all hover:scale-110',
                      color === c && 'ring-2 ring-ring scale-110',
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => onColorChange(c)}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="State name…"
            className="flex-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={!value.trim()}
            className="flex-1"
          >
            <IconPlus size={14} className="mr-1" />
            Add State
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
