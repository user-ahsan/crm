'use client';

import { useState } from 'react';
import { IconEye, IconPlus, IconTrash, IconEdit, IconCheck } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { SavedView, ViewEntityType } from '@/types/saved-view.types';
import { useSavedViews } from '@/hooks/useSavedViews';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';

interface ViewsDropdownProps {
  entityType: ViewEntityType;
  currentFilters: Record<string, unknown>;
  onLoadView: (view: SavedView) => void;
  hasActiveFilters: boolean;
}

export function ViewsDropdown({
  entityType,
  currentFilters,
  onLoadView,
  hasActiveFilters,
}: ViewsDropdownProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SavedView | null>(null);

  const { views, loading, refresh, createView, updateView, deleteView } = useSavedViews(entityType);

  const handleSave = async () => {
    if (!viewName.trim()) {
      toast.error('Please enter a view name');
      return;
    }
    const created = await createView({
      name: viewName.trim(),
      entityType,
      filters: currentFilters,
    });
    if (created) {
      toast.success('View saved');
      setSaveDialogOpen(false);
      setViewName('');
    } else {
      toast.error('Failed to save view');
    }
  };

  const handleUpdate = async () => {
    if (!editingView || !editName.trim()) return;
    const updated = await updateView(editingView.id, {
      name: editName.trim(),
      entityType: editingView.entityType,
      filters: editingView.filters,
    });
    if (updated) {
      toast.success('View updated');
      setEditingView(null);
      setEditName('');
    } else {
      toast.error('Failed to update view');
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const ok = await deleteView(deleteTarget.id);
    if (ok) {
      toast.success('View deleted');
    } else {
      toast.error('Failed to delete view');
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="gap-2">
              <IconEye className="size-4" />
              Views
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-56">
          {views.length === 0 && (
            <DropdownMenuItem disabled>{loading ? 'Loading views…' : 'No saved views'}</DropdownMenuItem>
          )}
          {views.map((view) => (
            <DropdownMenuItem
              key={view.id}
              onClick={() => onLoadView(view)}
              className="flex items-center justify-between"
            >
              <span className="truncate">{view.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setViewName('');
              setSaveDialogOpen(true);
            }}
            disabled={!hasActiveFilters}
          >
            <IconPlus className="mr-2 size-4" />
            Save Current Filters
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setManageDialogOpen(true); refresh(); }}>
            <IconEdit className="mr-2 size-4" />
            Manage Views
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current Filters as View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g. High Priority Leads"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save View</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Views Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Views</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Loading views…
              </p>
            ) : views.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No saved views yet.
              </p>
            ) : (
              views.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  {editingView?.id === view.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleUpdate}
                        aria-label={`Save changes to view ${view.name}`}
                      >
                        <IconCheck className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium">{view.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingView(view);
                            setEditName(view.name);
                          }}
                          aria-label={`Edit view ${view.name}`}
                        >
                          <IconEdit className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteTarget(view)}
                          aria-label={`Delete view ${view.name}`}
                        >
                          <IconTrash className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Saved View"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
            : 'Are you sure you want to delete this saved view? This action cannot be undone.'
        }
        onConfirm={handleDeleteConfirmed}
        confirmLabel="Delete"
        variant="destructive"
      />
    </>
  );
}

export default ViewsDropdown;
