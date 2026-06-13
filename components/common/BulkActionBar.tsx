'use client';

import { useState } from 'react';
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
import {
  LEAD_STATUSES,
  LEAD_PRIORITIES,
  TASK_STATUSES,
  USERS,
} from '@/lib/constants';
import { IconX, IconTag, IconUser, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';

interface BulkActionBarProps {
  selectedIds: string[];
  entityType: 'lead' | 'contact' | 'company' | 'task';
  onAction: (action: string, ids: string[], payload?: Record<string, string>) => Promise<void>;
  onClear: () => void;
}

export function BulkActionBar({ selectedIds, entityType, onAction, onClear }: BulkActionBarProps) {
  const [actionPayload, setActionPayload] = useState<Record<string, string>>({});
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  if (selectedIds.length === 0) return null;

  const handleAction = async (action: string) => {
    setProcessing(true);
    try {
      await onAction(action, selectedIds, actionPayload);
      toast.success(`${action.replace('_', ' ')} applied to ${selectedIds.length} ${entityType}(s)`);
      setActionPayload({});
      setActiveAction(null);
      onClear();
    } catch {
      toast.error(`Failed to apply ${action}`);
    } finally {
      setProcessing(false);
    }
  };

  const renderPayloadInput = () => {
    switch (activeAction) {
      case 'change_status':
        return (
          <Select
            value={actionPayload.status || ''}
            onValueChange={(v) => setActionPayload((p) => ({ ...p, status: v ?? '' }))}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {(entityType === 'task' ? TASK_STATUSES : LEAD_STATUSES).map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'change_priority':
        return (
          <Select
            value={actionPayload.priority || ''}
            onValueChange={(v) => setActionPayload((p) => ({ ...p, priority: v ?? '' }))}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'assign_to':
        return (
          <Select
            value={actionPayload.assignedTo || ''}
            onValueChange={(v) => setActionPayload((p) => ({ ...p, assignedTo: v ?? '' }))}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {USERS.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'add_tag':
        return (
          <input
            className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Tag name"
            value={actionPayload.tag || ''}
            onChange={(e) => setActionPayload({ ...actionPayload, tag: e.target.value })}
          />
        );
      default:
        return null;
    }
  };

  const getActions = () => {
    switch (entityType) {
      case 'lead':
        return [
          { key: 'change_status', label: 'Change Status', icon: null },
          { key: 'change_priority', label: 'Change Priority', icon: null },
          { key: 'assign_to', label: 'Assign To', icon: <IconUser className="size-4" /> },
          { key: 'add_tag', label: 'Add Tag', icon: <IconTag className="size-4" /> },
          { key: 'delete', label: 'Delete', icon: <IconTrash className="size-4" /> },
        ];
      case 'contact':
        return [
          { key: 'add_tag', label: 'Add Tag', icon: <IconTag className="size-4" /> },
          { key: 'delete', label: 'Delete', icon: <IconTrash className="size-4" /> },
        ];
      case 'company':
        return [
          { key: 'add_tag', label: 'Add Tag', icon: <IconTag className="size-4" /> },
          { key: 'delete', label: 'Delete', icon: <IconTrash className="size-4" /> },
        ];
      case 'task':
        return [
          { key: 'change_status', label: 'Change Status', icon: null },
          { key: 'assign_to', label: 'Assign To', icon: <IconUser className="size-4" /> },
          { key: 'delete', label: 'Delete', icon: <IconTrash className="size-4" /> },
        ];
      default:
        return [];
    }
  };

  const actions = getActions();

  return (
    <div className="sticky top-0 z-10 -mx-4 -mt-2 mb-4 rounded-lg border bg-background px-4 py-3 shadow-sm sm:-mx-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-medium">
          {selectedIds.length} selected
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          {actions.map((action) => (
            <Popover
              key={action.key}
              open={activeAction === action.key}
              onOpenChange={(open) => {
                if (!open) {
                  setActiveAction(null);
                  setActionPayload({});
                }
              }}
            >
              <PopoverTrigger
                render={<button type="button" />}
                className="inline-flex h-9 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                onClick={() => setActiveAction(action.key)}
              >
                {action.icon}
                {action.label}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="flex items-center gap-2">
                  {renderPayloadInput()}
                  {activeAction === 'delete' ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleAction('delete')}
                      disabled={processing}
                    >
                      Confirm Delete
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleAction(action.key)}
                      disabled={processing || !actionPayloadValid(action.key)}
                    >
                      Apply
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto">
          <IconX className="mr-1 size-4" />
          Clear
        </Button>
      </div>
    </div>
  );

  function actionPayloadValid(action: string): boolean {
    switch (action) {
      case 'change_status': return !!actionPayload.status;
      case 'change_priority': return !!actionPayload.priority;
      case 'assign_to': return !!actionPayload.assignedTo;
      case 'add_tag': return !!actionPayload.tag?.trim();
      default: return true;
    }
  }
}
