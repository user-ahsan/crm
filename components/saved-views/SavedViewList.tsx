'use client';

import { IconEye, IconEdit, IconTrash } from '@tabler/icons-react';
import type { SavedView, ViewEntityType } from '@/types/saved-view.types';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ENTITY_LABELS: Record<ViewEntityType, string> = {
  lead: 'Lead',
  contact: 'Contact',
  company: 'Company',
  deal: 'Deal',
  task: 'Task',
  meeting: 'Meeting',
};

function formatSortInfo(sortBy: string | null, sortOrder: 'asc' | 'desc' | null): string {
  if (!sortBy) return 'Default order';
  const orderLabel = sortOrder === 'desc' ? 'desc' : 'asc';
  return `${sortBy} (${orderLabel})`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface SavedViewListProps {
  entityType: ViewEntityType;
  views: SavedView[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onApply?: (view: SavedView) => void;
  onEdit: (view: SavedView) => void;
  onDelete: (view: SavedView) => void;
}

export function SavedViewList({
  entityType,
  views,
  loading,
  error,
  onRefresh,
  onApply,
  onEdit,
  onDelete,
}: SavedViewListProps) {
  const entityLabel = ENTITY_LABELS[entityType];

  if (loading) {
    return <LoadingSkeleton type="table" count={4} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRefresh} />;
  }

  if (views.length === 0) {
    return (
      <EmptyState
        title={`No ${entityLabel} views`}
        description={`No saved views exist for ${entityLabel.toLowerCase()}s yet. Create one to save your filter configurations.`}
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Sort</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {views.map((view) => (
            <TableRow key={view.id}>
              <TableCell>
                <span className="font-medium">{view.name}</span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-normal">
                  {formatSortInfo(view.sortBy, view.sortOrder)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(view.createdAt)}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {onApply && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onApply(view)}
                      aria-label={`Apply ${view.name}`}
                    >
                      <IconEye className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(view)}
                    aria-label={`Edit ${view.name}`}
                  >
                    <IconEdit className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(view)}
                    aria-label={`Delete ${view.name}`}
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
  );
}
