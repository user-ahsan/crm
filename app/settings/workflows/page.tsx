'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useWorkflows } from '@/hooks/useWorkflows';
import type { WorkflowState, WorkflowEntityType, WorkflowTransition } from '@/types/workflow.types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  IconHierarchy,
  IconPlus,
  IconTrash,
  IconPencil,
  IconArrowUp,
  IconArrowDown,
  IconCheck,
  IconX,
  IconCircle,
  IconSwitchHorizontal,
} from '@tabler/icons-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ENTITY_TABS: { value: WorkflowEntityType; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'deal', label: 'Deal' },
  { value: 'task', label: 'Task' },
];

function WorkflowTab({ entityType }: { entityType: WorkflowEntityType }) {
  const {
    states, transitions, loading, error, refresh,
    createState, updateState, deleteState, reorderStates,
    createTransition, deleteTransition,
  } = useWorkflows(entityType);

  const [newStateName, setNewStateName] = useState('');
  const [newStateColor, setNewStateColor] = useState('#6366f1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingTransition, setAddingTransition] = useState(false);
  const [transitionFrom, setTransitionFrom] = useState('');
  const [transitionTo, setTransitionTo] = useState('');
  const [transitionLabel, setTransitionLabel] = useState('');

  const handleAddState = useCallback(async () => {
    if (!newStateName.trim()) return;
    const result = await createState({ name: newStateName.trim(), color: newStateColor, entityType });
    if (result) {
      toast.success('State created');
      setNewStateName('');
    } else {
      toast.error('Failed to create state');
    }
  }, [newStateName, newStateColor, entityType, createState]);

  const handleStartEdit = useCallback((state: WorkflowState) => {
    setEditingId(state.id);
    setEditName(state.name);
    setEditColor(state.color);
  }, []);

  const handleSaveEdit = useCallback(async (id: string) => {
    if (!editName.trim()) return;
    const result = await updateState(id, { name: editName.trim(), color: editColor });
    if (result) {
      toast.success('State updated');
      setEditingId(null);
    } else {
      toast.error('Failed to update state');
    }
  }, [editName, editColor, updateState]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleMoveUp = useCallback(async (index: number) => {
    if (index === 0) return;
    const newIds = states.map((s) => s.id);
    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
    await reorderStates(newIds);
  }, [states, reorderStates]);

  const handleMoveDown = useCallback(async (index: number) => {
    if (index === states.length - 1) return;
    const newIds = states.map((s) => s.id);
    [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
    await reorderStates(newIds);
  }, [states, reorderStates]);

  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    const success = await deleteState(deletingId);
    if (success) {
      toast.success('State deleted');
      setDeletingId(null);
    } else {
      toast.error('Failed to delete state');
    }
  }, [deletingId, deleteState]);

  const handleAddTransition = useCallback(async () => {
    if (!transitionFrom || !transitionTo) return;
    if (transitionFrom === transitionTo) {
      toast.error('Cannot create a self-transition');
      return;
    }
    const result = await createTransition({ fromStateId: transitionFrom, toStateId: transitionTo, label: transitionLabel });
    if (result) {
      toast.success('Transition created');
      setAddingTransition(false);
      setTransitionFrom('');
      setTransitionTo('');
      setTransitionLabel('');
    } else {
      toast.error('Failed to create transition');
    }
  }, [transitionFrom, transitionTo, transitionLabel, createTransition]);

  const handleDeleteTransition = useCallback(async (id: string) => {
    const success = await deleteTransition(id);
    if (success) {
      toast.success('Transition deleted');
    } else {
      toast.error('Failed to delete transition');
    }
  }, [deleteTransition]);

  if (loading) {
    return <LoadingSkeleton type="list" count={4} />;
  }

  if (error) {
    return <ErrorState title="Failed to load workflows" message={error} onRetry={refresh} />;
  }

  const stateTransitions = transitions.filter((t) =>
    states.some((s) => s.id === t.fromStateId) || states.some((s) => s.id === t.toStateId),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>States</CardTitle>
              <CardDescription>Define the workflow stages for {entityType}s.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {states.length === 0 ? (
            <EmptyState
              icon={<IconHierarchy size={48} stroke={1.5} />}
              title="No states defined"
              description="Add your first workflow state to get started."
            />
          ) : (
            <div className="space-y-2">
              {states.map((state, index) => (
                <div
                  key={state.id}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="flex size-4 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <IconArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === states.length - 1}
                      className="flex size-4 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <IconArrowDown size={12} />
                    </button>
                  </div>

                  <IconCircle size={16} style={{ color: state.color }} fill={state.color} />

                  {editingId === state.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 flex-1"
                        placeholder="State name"
                      />
                      <Input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="h-8 w-12 p-1"
                      />
                      <Button variant="ghost" size="sm" onClick={() => handleSaveEdit(state.id)}>
                        <IconCheck size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                        <IconX size={16} />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{state.name}</span>
                      <Badge variant="outline" className="text-xs">Order {index + 1}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => handleStartEdit(state)}>
                        <IconPencil size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingId(state.id)}>
                        <IconTrash size={14} />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 border-t pt-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="new-state-name">New State</Label>
              <Input
                id="new-state-name"
                placeholder="e.g. Qualified"
                value={newStateName}
                onChange={(e) => setNewStateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddState(); }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-state-color">Color</Label>
              <Input
                id="new-state-color"
                type="color"
                value={newStateColor}
                onChange={(e) => setNewStateColor(e.target.value)}
                className="h-9 w-14 p-1"
              />
            </div>
            <Button size="sm" onClick={handleAddState} disabled={!newStateName.trim()}>
              <IconPlus size={14} className="mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transitions</CardTitle>
              <CardDescription>Define allowed transitions between states.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAddingTransition((p) => !p)}>
              <IconSwitchHorizontal size={14} className="mr-1" />
              {addingTransition ? 'Cancel' : 'Add Transition'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {addingTransition && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <div className="space-y-1">
                <Label>From</Label>
                <Select value={transitionFrom} onValueChange={(v) => { if (v !== null) setTransitionFrom(v); }}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Select value={transitionTo} onValueChange={(v) => { if (v !== null) setTransitionTo(v); }}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="transition-label">Label</Label>
                <Input
                  id="transition-label"
                  placeholder="e.g. Move to"
                  value={transitionLabel}
                  onChange={(e) => setTransitionLabel(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button size="sm" onClick={handleAddTransition} disabled={!transitionFrom || !transitionTo}>
                <IconCheck size={14} className="mr-1" />
                Save
              </Button>
            </div>
          )}

          {stateTransitions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No transitions defined yet. Add a transition to allow moving between states.
            </p>
          ) : (
            <div className="space-y-2">
              {stateTransitions.map((t) => {
                const fromState = states.find((s) => s.id === t.fromStateId);
                const toState = states.find((s) => s.id === t.toStateId);
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {fromState ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          <IconCircle size={12} style={{ color: fromState.color }} fill={fromState.color} />
                          {fromState.name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Deleted state</span>
                      )}
                      <span className="text-muted-foreground">&rarr;</span>
                      {toState ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          <IconCircle size={12} style={{ color: toState.color }} fill={toState.color} />
                          {toState.name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Deleted state</span>
                      )}
                      {t.label && (
                        <Badge variant="secondary" className="text-xs ml-1">{t.label}</Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => handleDeleteTransition(t.id)}>
                      <IconTrash size={14} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        title="Delete State"
        description="Are you sure you want to delete this state? Related transitions will also be removed. This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<WorkflowEntityType>('lead');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow Builder"
        description="Create and manage custom workflows for leads, deals, and tasks."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WorkflowEntityType)}>
        <TabsList>
          {ENTITY_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
        {ENTITY_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <WorkflowTab entityType={tab.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
