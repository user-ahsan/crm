'use client';

import { useState, useEffect, useCallback } from 'react';
import { IconEye, IconPlus, IconTrash, IconEdit, IconCheck } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { SavedView, ViewEntityType } from '@/types/saved-view.types';
import { savedViewService } from '@/services/saved-view.service';
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
  const [views, setViews] = useState<SavedView[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [editName, setEditName] = useState('');

  const loadViews = useCallback(async () => {
    try {
      const data = await savedViewService.getViews(entityType);
      setViews(data);
    } catch {
      toast.error('Failed to load saved views');
    }
  }, [entityType]);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  const handleSave = async () => {
    if (!viewName.trim()) {
      toast.error('Please enter a view name');
      return;
    }
    try {
      await savedViewService.create({
        name: viewName.trim(),
        entityType,
        filters: currentFilters,
      });
      toast.success('View saved');
      setSaveDialogOpen(false);
      setViewName('');
      loadViews();
    } catch {
      toast.error('Failed to save view');
    }
  };

  const handleUpdate = async () => {
    if (!editingView || !editName.trim()) return;
    try {
      await savedViewService.update(editingView.id, {
        name: editName.trim(),
        entityType: editingView.entityType,
        filters: editingView.filters,
      });
      toast.success('View updated');
      setEditingView(null);
      setEditName('');
      loadViews();
    } catch {
      toast.error('Failed to update view');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await savedViewService.delete(id);
      toast.success('View deleted');
      loadViews();
    } catch {
      toast.error('Failed to delete view');
    }
  };

  const handleLoad = (view: SavedView) => {
    onLoadView(view);
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
            <DropdownMenuItem disabled>No saved views</DropdownMenuItem>
          )}
          {views.map((view) => (
            <DropdownMenuItem
              key={view.id}
              onClick={() => handleLoad(view)}
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
          <DropdownMenuItem onClick={() => { setManageDialogOpen(true); loadViews(); }}>
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
            {views.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No saved views yet.
              </p>
            )}
            {views.map((view) => (
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
                      >
                        <IconEdit className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(view.id)}
                      >
                        <IconTrash className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
