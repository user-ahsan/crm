'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { SavedView, ViewEntityType } from '@/types/saved-view.types';
import { savedViewService } from '@/services/saved-view.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const ENTITY_OPTIONS: { value: ViewEntityType; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'contact', label: 'Contact' },
  { value: 'company', label: 'Company' },
  { value: 'deal', label: 'Deal' },
  { value: 'task', label: 'Task' },
  { value: 'meeting', label: 'Meeting' },
];

interface SavedViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view?: SavedView | null;
  defaultEntityType?: ViewEntityType;
  onSuccess: () => void;
}

export function SavedViewDialog({
  open,
  onOpenChange,
  view,
  defaultEntityType = 'lead',
  onSuccess,
}: SavedViewDialogProps) {
  const isEditing = !!view;
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState<ViewEntityType>(defaultEntityType);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (view) {
        setName(view.name);
        setEntityType(view.entityType);
      } else {
        setName('');
        setEntityType(defaultEntityType);
      }
    }
  }, [open, view, defaultEntityType]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('View name is required');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && view) {
        await savedViewService.update(view.id, {
          name: name.trim(),
          entityType,
          filters: view.filters,
          sortBy: view.sortBy,
          sortOrder: view.sortOrder,
        });
        toast.success('View updated');
      } else {
        await savedViewService.create({
          name: name.trim(),
          entityType,
          filters: {},
        });
        toast.success('View created');
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} view`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit View' : 'Create View'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the view name.'
              : 'Create a new saved view to quickly access filtered data.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="view-name">Name</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High Priority Leads"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              disabled={saving}
              autoFocus
            />
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="entity-type">Entity Type</Label>
              <Select
                value={entityType}
                onValueChange={(val) => val && setEntityType(val as ViewEntityType)}
                disabled={saving}
              >
                <SelectTrigger className="w-full" id="entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
