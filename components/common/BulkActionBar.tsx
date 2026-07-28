'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
import {
  IconTrash,
  IconUser,
  IconTags,
  IconDownload,
  IconX,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { useTeamContext } from '@/context/TeamContext';
import { LEAD_STATUSES, LEAD_PRIORITIES, TASK_STATUSES } from '@/lib/constants';
import { cn } from '@/lib/utils';

/* ── Shared types ─────────────────────────────────────────────────── */

export interface TagOption {
  id: string;
  name: string;
  color: string;
}

export interface ExtraAction {
  label: string;
  icon: React.ReactNode;
  onClick: (ids: string[]) => void;
}

/* ── Props ────────────────────────────────────────────────────────── */

export interface BulkActionBarProps {
  /** Currently selected row IDs */
  selectedIds: Set<string>;
  /** Called when the user clears the selection */
  onClear: () => void;
  /** Entity type label used in UI copy */
  entityType: 'lead' | 'contact' | 'company' | 'task' | 'meeting' | 'deal';
  /** Handler for bulk delete — shows a confirm dialog first */
  onBulkDelete?: (ids: string[]) => Promise<void>;
  /** Handler for bulk status/priority updates (leads & tasks) */
  onBulkUpdate?: (ids: string[], data: Record<string, unknown>) => Promise<void>;
  /** Handler for bulk assignment to a user */
  onBulkAssign?: (ids: string[], userId: string) => Promise<void>;
  /** Handler for bulk tag addition */
  onBulkTag?: (ids: string[], tagNames: string[]) => Promise<void>;
  /** Handler for exporting selected rows as CSV */
  onBulkExport?: (ids: string[]) => void;
  /** Available tags for the tag picker dropdown */
  tags?: TagOption[];
  /** Extra action buttons appended after the built-in actions */
  extraActions?: ExtraAction[];
}

/* ── Component ────────────────────────────────────────────────────── */

export function BulkActionBar({
  selectedIds,
  onClear,
  entityType,
  onBulkDelete,
  onBulkUpdate,
  onBulkAssign,
  onBulkTag,
  onBulkExport,
  tags = [],
  extraActions,
}: BulkActionBarProps) {
  /* ── Team context for member list ─────────────────────────────── */
  const { members, loading: teamLoading } = useTeamContext();

  /* ── State ────────────────────────────────────────────────────── */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');

  const [processing, setProcessing] = useState(false);

  /* ── Derived ──────────────────────────────────────────────────── */
  const ids = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const count = selectedIds.size;

  const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
  const statuses = entityType === 'task' ? TASK_STATUSES : LEAD_STATUSES;
  const showStatusUpdate = !!onBulkUpdate && (entityType === 'lead' || entityType === 'task');
  const showPriorityUpdate = !!onBulkUpdate && (entityType === 'lead' || entityType === 'task');

  /* ── Reset helper ─────────────────────────────────────────────── */
  const resetSelections = useCallback(() => {
    setSelectedUserId('');
    setSelectedTagId('');
    setSelectedStatus('');
    setSelectedPriority('');
  }, []);

  /* ── Handlers ─────────────────────────────────────────────────── */

  const handleDeleteConfirm = useCallback(async () => {
    if (!onBulkDelete) return;
    setProcessing(true);
    setDeleteDialogOpen(false);
    try {
      await onBulkDelete(ids);
      toast.success(`Deleted ${count} ${entityLabel}${count !== 1 ? 's' : ''}`);
      resetSelections();
      onClear();
    } catch {
      toast.error(`Failed to delete ${entityLabel}s`);
    } finally {
      setProcessing(false);
    }
  }, [onBulkDelete, ids, count, entityLabel, resetSelections, onClear]);

  const handleAssign = useCallback(async () => {
    if (!onBulkAssign || !selectedUserId) return;
    setProcessing(true);
    setAssignOpen(false);
    try {
      await onBulkAssign(ids, selectedUserId);
      const user = members.find((u) => u.id === selectedUserId);
      toast.success(
        `Assigned ${count} ${entityLabel}${count !== 1 ? 's' : ''} to ${user?.user?.name ?? selectedUserId}`,
      );
      resetSelections();
      onClear();
    } catch {
      toast.error(`Failed to assign ${entityLabel}s`);
    } finally {
      setProcessing(false);
    }
  }, [onBulkAssign, selectedUserId, ids, count, entityLabel, resetSelections, onClear, members]);

  const handleTag = useCallback(async () => {
    if (!onBulkTag || !selectedTagId) return;
    setProcessing(true);
    setTagOpen(false);
    try {
      const tagName = tags.find((t) => t.id === selectedTagId)?.name ?? selectedTagId;
      await onBulkTag(ids, [tagName]);
      toast.success(`Tagged ${count} ${entityLabel}${count !== 1 ? 's' : ''}`);
      resetSelections();
      onClear();
    } catch {
      toast.error(`Failed to tag ${entityLabel}s`);
    } finally {
      setProcessing(false);
    }
  }, [onBulkTag, selectedTagId, tags, ids, count, entityLabel, resetSelections, onClear]);

  const handleStatusUpdate = useCallback(async () => {
    if (!onBulkUpdate || !selectedStatus) return;
    setProcessing(true);
    setStatusOpen(false);
    try {
      await onBulkUpdate(ids, { status: selectedStatus });
      toast.success(`Updated status for ${count} ${entityLabel}${count !== 1 ? 's' : ''}`);
      resetSelections();
      onClear();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setProcessing(false);
    }
  }, [onBulkUpdate, selectedStatus, ids, count, entityLabel, resetSelections, onClear]);

  const handlePriorityUpdate = useCallback(async () => {
    if (!onBulkUpdate || !selectedPriority) return;
    setProcessing(true);
    setPriorityOpen(false);
    try {
      await onBulkUpdate(ids, { priority: selectedPriority });
      toast.success(`Updated priority for ${count} ${entityLabel}${count !== 1 ? 's' : ''}`);
      resetSelections();
      onClear();
    } catch {
      toast.error('Failed to update priority');
    } finally {
      setProcessing(false);
    }
  }, [onBulkUpdate, selectedPriority, ids, count, entityLabel, resetSelections, onClear]);

  const handleExport = useCallback(() => {
    if (!onBulkExport) return;
    onBulkExport(ids);
  }, [onBulkExport, ids]);

  /* ── Empty state ──────────────────────────────────────────────── */
  if (count === 0) return null;

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <>
      {/* Fixed bottom bar */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60',
          'transition-all duration-300 ease-in-out',
          count > 0
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none',
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
          {/* Selection count */}
          <span className="mr-2 shrink-0 whitespace-nowrap text-sm font-medium tabular-nums">
            <span className="text-foreground">{count}</span>{' '}
            <span className="text-muted-foreground">
              {entityLabel}
              {count === 1 ? '' : 's'} selected
            </span>
          </span>

          {/* Divider */}
          <div className="hidden h-5 w-px bg-border sm:block" />

          {/* Action buttons */}
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {/* Delete */}
            {onBulkDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={processing}
                className="text-destructive hover:text-destructive"
              >
                <IconTrash className="mr-1 size-3.5" />
                Delete
              </Button>
            )}

            {/* Assign To */}
            {onBulkAssign && (
              <Popover open={assignOpen} onOpenChange={setAssignOpen}>
                <PopoverTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={processing || teamLoading} />
                  }
                >
                  <IconUser className="mr-1 size-3.5" />
                  Assign To
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="start" side="top">
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Assign to user</div>
                    <Select value={selectedUserId} onValueChange={(val) => val && setSelectedUserId(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.user?.name ?? member.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleAssign}
                      disabled={!selectedUserId || processing}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Add Tag */}
            {onBulkTag && tags.length > 0 && (
              <Popover open={tagOpen} onOpenChange={setTagOpen}>
                <PopoverTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={processing} />
                  }
                >
                  <IconTags className="mr-1 size-3.5" />
                  Add Tag
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="start" side="top">
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Add tag</div>
                    <Select value={selectedTagId} onValueChange={(val) => val && setSelectedTagId(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tag..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tags.map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleTag}
                      disabled={!selectedTagId || processing}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Status update (leads / tasks only) */}
            {showStatusUpdate && (
              <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                <PopoverTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={processing} />
                  }
                >
                  Status
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="start" side="top">
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Change status</div>
                    <Select value={selectedStatus} onValueChange={(val) => val && setSelectedStatus(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleStatusUpdate}
                      disabled={!selectedStatus || processing}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Priority update (leads / tasks only) */}
            {showPriorityUpdate && (
              <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
                <PopoverTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={processing} />
                  }
                >
                  Priority
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="start" side="top">
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Change priority</div>
                    <Select value={selectedPriority} onValueChange={(val) => val && setSelectedPriority(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority..." />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handlePriorityUpdate}
                      disabled={!selectedPriority || processing}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Export */}
            {onBulkExport && (
              <Button variant="outline" size="sm" onClick={handleExport} disabled={processing}>
                <IconDownload className="mr-1 size-3.5" />
                Export
              </Button>
            )}

            {/* Extra actions from parent */}
            {extraActions?.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => action.onClick(ids)}
                disabled={processing}
              >
                {action.icon}
                {action.label && <span className="ml-1.5">{action.label}</span>}
              </Button>
            ))}
          </div>

          {/* Clear */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={processing}
            className="shrink-0"
          >
            <IconX className="mr-1 size-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${count} ${entityLabel}${count !== 1 ? 's' : ''}?`}
        description={`Are you sure you want to delete ${count === 1 ? 'this' : 'these'} ${entityLabel.toLowerCase()}${count !== 1 ? 's' : ''}? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Delete"
        variant="destructive"
      />
    </>
  );
}
