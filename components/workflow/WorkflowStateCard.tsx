'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { WorkflowState, WorkflowTransition } from '@/types/workflow.types';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  IconGripVertical,
  IconTrash,
  IconPencil,
  IconCheck,
  IconLink,
  IconDotsCircleHorizontal,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

/* ── Predefined palette ─────────────────────────────────── */
const PRESET_COLORS = [
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#84cc16', // lime
  '#eab308', // yellow
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // purple
  '#6b7280', // gray
  '#1e293b', // slate
];

interface WorkflowStateCardProps {
  state: WorkflowState;
  index: number;
  isDragging: boolean;
  dragIndex: number | null;
  isConnectSource: boolean;
  isConnecting: boolean;
  outgoingTransitions: WorkflowTransition[];
  allStates: WorkflowState[];
  onEditName: (id: string, name: string) => void;
  onEditColor: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onStartConnect: (id: string) => void;
  onCompleteConnect: (id: string) => void;
}

export function WorkflowStateCard({
  state,
  index,
  isDragging,
  dragIndex,
  isConnectSource,
  isConnecting,
  outgoingTransitions,
  allStates,
  onEditName,
  onEditColor,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onStartConnect,
  onCompleteConnect,
}: WorkflowStateCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [editValue, setEditValue] = useState(state.name);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [customColor, setCustomColor] = useState(state.color);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Focus input when editing starts */
  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  const handleSaveName = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== state.name) {
      onEditName(state.id, trimmed);
    } else {
      setEditValue(state.name);
    }
    setEditingName(false);
  }, [editValue, state.name, state.id, onEditName]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSaveName();
      if (e.key === 'Escape') {
        setEditValue(state.name);
        setEditingName(false);
      }
    },
    [handleSaveName, state.name],
  );

  const handleSelectPreset = useCallback(
    (color: string) => {
      onEditColor(state.id, color);
      setCustomColor(color);
      setColorPickerOpen(false);
    },
    [state.id, onEditColor],
  );

  const handleCustomColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setCustomColor(val);
      onEditColor(state.id, val);
    },
    [state.id, onEditColor],
  );

  const handleCardClick = useCallback(() => {
    /* When in connect mode and this is NOT the source, create transition */
    if (isConnecting && !isConnectSource) {
      onCompleteConnect(state.id);
    }
  }, [isConnecting, isConnectSource, state.id, onCompleteConnect]);

  /* ── Derived state ─────────────────────────────────── */
  const showDropIndicator = dragIndex !== null && dragIndex !== index;

  return (
    <div
      className={cn(
        'group relative flex w-48 shrink-0 flex-col rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:shadow-md',
        isDragging && 'opacity-50 shadow-lg scale-[1.02]',
        isConnectSource && 'ring-2 ring-primary border-primary',
        isConnecting &&
          !isConnectSource &&
          'cursor-pointer hover:ring-2 hover:ring-emerald-400 hover:border-emerald-400',
        showDropIndicator && 'border-dashed border-primary/50',
      )}
      draggable={!editingName}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, index)}
      onClick={handleCardClick}
      role="listitem"
      aria-label={`Workflow state: ${state.name}`}
    >
      {/* Color bar */}
      <div
        className="absolute inset-x-0 top-0 h-1.5 rounded-t-xl"
        style={{ backgroundColor: state.color }}
      />

      {/* Main content */}
      <div className="mt-3 flex flex-col gap-2 px-3 pb-3">
        {/* Top row: drag handle, dot, name, actions */}
        <div className="flex items-center gap-1.5">
          {/* Drag handle */}
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            aria-label="Drag to reorder"
            tabIndex={-1}
          >
            <IconGripVertical size={14} />
          </button>

          {/* Color dot — click to open color picker */}
          <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="size-3 shrink-0 rounded-full ring-offset-2 ring-offset-background hover:ring-2 hover:ring-ring transition-all"
                  style={{ backgroundColor: state.color }}
                  aria-label="Change color"
                />
              }
            />
            <PopoverContent
              side="bottom"
              align="start"
              className="w-56 p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Preset colors
                </p>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        'size-7 rounded-full ring-offset-2 ring-offset-background transition-all hover:scale-110',
                        state.color === c && 'ring-2 ring-ring scale-110',
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => handleSelectPreset(c)}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1 border-t">
                  <Input
                    type="color"
                    value={customColor}
                    onChange={handleCustomColorChange}
                    className="size-8 w-14 cursor-pointer p-0.5"
                    aria-label="Custom color"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Custom
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Name (editable inline) */}
          {editingName ? (
            <div className="flex flex-1 items-center gap-1 min-w-0">
              <Input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleSaveName}
                className="h-7 text-xs flex-1 min-w-0 px-1.5"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveName();
                }}
                className="shrink-0 text-green-600 hover:text-green-700"
              >
                <IconCheck size={12} />
              </button>
            </div>
          ) : (
            <span
              className="flex-1 truncate text-sm font-medium cursor-pointer"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingName(true);
                setEditValue(state.name);
              }}
              title={state.name}
            >
              {state.name}
            </span>
          )}

          {/* Action buttons (hidden while editing name) */}
          {!editingName && (
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Edit name */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingName(true);
                  setEditValue(state.name);
                }}
                className="p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
                aria-label="Rename"
              >
                <IconPencil size={11} />
              </button>

              {/* Connect / transition */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isConnectSource) {
                    /* Cancel if already connecting from this card */
                    onCompleteConnect(state.id);
                  } else {
                    onStartConnect(state.id);
                  }
                }}
                className={cn(
                  'p-0.5 text-muted-foreground/50 hover:text-muted-foreground',
                  isConnectSource && 'text-primary',
                )}
                aria-label={
                  isConnectSource
                    ? 'Cancel connection'
                    : 'Create transition from this state'
                }
              >
                <IconLink size={11} />
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(state.id);
                }}
                className="p-0.5 text-destructive/50 hover:text-destructive"
                aria-label="Delete state"
              >
                <IconTrash size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Outgoing transitions list */}
        {outgoingTransitions.length > 0 && (
          <div className="space-y-1 border-t border-border/50 pt-1.5">
            {outgoingTransitions.map((t) => {
              const target = allStates.find((s) => s.id === t.toStateId);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-1 text-[10px] leading-tight text-muted-foreground"
                  title={`→ ${target?.name ?? 'Deleted'}${t.label ? ` (${t.label})` : ''}`}
                >
                  <IconDotsCircleHorizontal size={8} className="shrink-0" />
                  <span
                    className="inline-block size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: target?.color ?? '#888' }}
                  />
                  <span className="truncate max-w-[6rem]">
                    {target?.name ?? (
                      <span className="italic">Deleted</span>
                    )}
                  </span>
                  {t.label && (
                    <span className="shrink-0 rounded bg-muted px-1 text-[8px] font-medium">
                      {t.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
