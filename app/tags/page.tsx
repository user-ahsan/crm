'use client';

import { useState, useCallback, useEffect } from 'react';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Tag } from '@/types/tag.types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { TagBadge } from '@/components/common/TagBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useTags } from '@/hooks/useTags';
import { tagService } from '@/services/tag.service';

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#64748b',
];

function TagsPage() {
  const { tags, loading, error, refresh, createTag, updateTag, deleteTag } = useTags();
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#6366f1');
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  useEffect(() => {
    tagService.getUsageCounts().then(setUsageCounts).catch(() => {});
  }, [tags]);

  const handleOpenCreate = useCallback(() => {
    setEditingTag(null);
    setTagName('');
    setTagColor('#6366f1');
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!tagName.trim()) {
      toast.error('Tag name is required');
      return;
    }
    try {
      if (editingTag) {
        await updateTag(editingTag.id, { name: tagName.trim(), color: tagColor });
        toast.success('Tag updated');
      } else {
        const created = await createTag(tagName.trim(), tagColor);
        if (created) toast.success('Tag created');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Failed to save tag');
    }
  }, [tagName, tagColor, editingTag, createTag, updateTag]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const success = await deleteTag(deleteTarget.id);
      if (success) {
        toast.success('Tag deleted');
      } else {
        toast.error('Failed to delete tag');
      }
    } catch {
      toast.error('Failed to delete tag');
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteTag]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tags" description="Manage all tags used across the CRM" />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tags" description="Manage all tags used across the CRM" />
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tags" description="Manage all tags used across the CRM">
        <Button onClick={handleOpenCreate}>
          <IconPlus className="mr-2 size-4" />
          New Tag
        </Button>
      </PageHeader>

      {tags.length === 0 ? (
        <EmptyState
          title="No tags"
          description="Create your first tag to start organizing leads, contacts, and companies."
          action={{ label: 'Create Tag', onClick: handleOpenCreate }}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Usage Count</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <TagBadge name={tag.name} color={tag.color} size="md" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="size-4 rounded-full border"
                        style={{ backgroundColor: tag.color }}
                      />
                      <code className="text-xs text-muted-foreground">{tag.color}</code>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {usageCounts[tag.id] ?? 0}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleOpenEdit(tag)}
                        aria-label={`Edit ${tag.name}`}
                      >
                        <IconEdit className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(tag)}
                        aria-label={`Delete ${tag.name}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
            <DialogDescription>
              {editingTag ? 'Update the tag name or color.' : 'Add a new tag to organize your entities.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g. VIP Client"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Color</label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`size-7 rounded-full border-2 transition-all ${
                      tagColor === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setTagColor(color)}
                    aria-label={`Select color ${color}`}
                  />
                ))}
                <div className="relative flex items-center">
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="size-7 cursor-pointer rounded-full border-0"
                    aria-label="Custom color"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingTag ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Tag"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will remove it from all entities.`}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}

export default TagsPage;
