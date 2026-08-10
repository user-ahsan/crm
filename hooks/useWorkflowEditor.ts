'use client';

import { useCallback, useMemo, useState } from 'react';
import { useWorkflows } from '@/hooks/useWorkflows';
import type {
  WorkflowEntityType,
  WorkflowTransition,
} from '@/types/workflow.types';

export interface WorkflowEditorState {
  /** Currently selected entity type */
  entityType: WorkflowEntityType;
  /** ID of the state being targeted as a connection source (connect mode) */
  connectSourceId: string | null;
  /** Whether connect mode is active */
  isConnecting: boolean;
  /** ID of the state pending delete confirmation */
  deletingId: string | null;
  /** ID of the state whose color picker is open */
  colorPickerOpenId: string | null;
}

export function useWorkflowEditor(entityType: WorkflowEntityType) {
  const workflows = useWorkflows(entityType);

  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [colorPickerOpenId, setColorPickerOpenId] = useState<string | null>(null);

  /* ── Connection drawing ──────────────────────────────── */

  const startConnecting = useCallback((stateId: string) => {
    setConnectSourceId(stateId);
    setIsConnecting(true);
  }, []);

  const cancelConnecting = useCallback(() => {
    setConnectSourceId(null);
    setIsConnecting(false);
  }, []);

  const completeConnection = useCallback(
    async (targetStateId: string): Promise<WorkflowTransition | undefined> => {
      if (!connectSourceId || connectSourceId === targetStateId) {
        cancelConnecting();
        return undefined;
      }
      const result = await workflows.createTransition({
        fromStateId: connectSourceId,
        toStateId: targetStateId,
        label: '',
      });
      cancelConnecting();
      return result;
    },
    [connectSourceId, workflows, cancelConnecting],
  );

  /* ── Delete confirmation ─────────────────────────────── */

  const requestDelete = useCallback((id: string) => {
    setDeletingId(id);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeletingId(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deletingId) return false;
    const ok = await workflows.deleteState(deletingId);
    setDeletingId(null);
    return ok;
  }, [deletingId, workflows]);

  /* ── Drag-and-drop reorder ───────────────────────────── */

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = useCallback(
    (_e: React.DragEvent, index: number) => {
      setDragIndex(index);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === dropIndex) {
        setDragIndex(null);
        return;
      }

      const ids = workflows.states.map((s) => s.id);
      const [moved] = ids.splice(dragIndex, 1);
      ids.splice(dropIndex, 0, moved ?? '');
      setDragIndex(null);
      await workflows.reorderStates(ids);
    },
    [dragIndex, workflows],
  );

  /* ── Color picker ────────────────────────────────────── */

  const toggleColorPicker = useCallback((id: string | null) => {
    setColorPickerOpenId((prev) => (prev === id ? null : id));
  }, []);

  /* ── Outgoing / incoming transitions lookup ──────────── */

  const getOutgoingTransitions = useCallback(
    (stateId: string): WorkflowTransition[] => {
      return workflows.transitions.filter((t) => t.fromStateId === stateId);
    },
    [workflows.transitions],
  );

  const getIncomingTransitions = useCallback(
    (stateId: string): WorkflowTransition[] => {
      return workflows.transitions.filter((t) => t.toStateId === stateId);
    },
    [workflows.transitions],
  );

  const statesWithTransitionCounts = useMemo(
    () =>
      workflows.states.map((s) => ({
        ...s,
        outgoingCount: getOutgoingTransitions(s.id).length,
        incomingCount: getIncomingTransitions(s.id).length,
      })),
    [workflows.states, workflows.transitions, getOutgoingTransitions, getIncomingTransitions],
  );

  return {
    /* Re-export all from useWorkflows */
    ...workflows,
    statesWithTransitionCounts,

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
    dragIndex,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,

    /* Color picker */
    colorPickerOpenId,
    toggleColorPicker,

    /* Lookup helpers */
    getOutgoingTransitions,
    getIncomingTransitions,
  };
}
