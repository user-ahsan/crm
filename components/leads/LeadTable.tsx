'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Lead } from '@/types/lead.types';
import type { LeadScore } from '@/types/lead-scoring.types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getUserName } from '@/lib/user-utils';
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/color-tokens';
import { formatCurrency, formatDate, getInitials } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { sortLeads, type LeadSortKey } from '@/modules/leads/leadFilters';
import { LeadScoreBadge } from '@/components/leads/LeadScoreBadge';
import {
  IconEdit,
  IconTrash,
  IconUsers,
  IconCurrencyDollar,
  IconCalendarEvent,
  IconMail,
  IconBuilding,
  IconChevronUp,
  IconChevronDown,
} from '@tabler/icons-react';

interface LeadTableProps {
  leads: Lead[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  scores?: Map<string, LeadScore>;
}

const LeadTable = memo(function LeadTable({ leads, onEdit, onDelete, selectedIds: externalSelectedIds, onSelectionChange, scores }: LeadTableProps) {
  const router = useRouter();
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = externalSelectedIds ?? internalSelectedIds;

  const setSelectedIds = useCallback((ids: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const next = typeof ids === 'function' ? ids(externalSelectedIds ?? internalSelectedIds) : ids;
    if (onSelectionChange) {
      onSelectionChange(next);
    } else {
      setInternalSelectedIds(next);
    }
  }, [externalSelectedIds, internalSelectedIds, onSelectionChange]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [setSelectedIds]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  }, [leads, selectedIds.size, setSelectedIds]);

  const isAllSelected = leads.length > 0 && selectedIds.size === leads.length;

  const navigateToLead = useCallback(
    (id: string) => {
      router.push(`/leads/${id}`);
    },
    [router]
  );

  const [sort, setSort] = useState<{ by: LeadSortKey; dir: 'asc' | 'desc' }>({
    by: 'createdAt',
    dir: 'desc',
  });

  const toggleSort = useCallback((key: LeadSortKey) => {
    setSort((prev) => {
      if (prev.by === key) {
        return { by: key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      // Numeric/date columns default to newest/highest first; text columns to A→Z.
      return {
        by: key,
        dir: key === 'createdAt' || key === 'estimatedValue' ? 'desc' : 'asc',
      };
    });
  }, []);

  const sortedLeads = useMemo(
    () => sortLeads(leads, sort.by, sort.dir),
    [leads, sort.by, sort.dir],
  );

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
          <IconUsers className="size-8 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-base font-medium text-foreground">No leads found</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          There are no leads to display yet. Create your first lead to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{selectedIds.size}</span>
          {selectedIds.size === 1 ? 'lead' : 'leads'} selected
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all leads"
              />
            </TableHead>
            <SortableHeader label="Name" sortKey="fullName" sort={sort} onToggle={toggleSort} className="min-w-[120px]" />
            <TableHead className="min-w-[140px]">Email</TableHead>
            <SortableHeader label="Company" sortKey="companyName" sort={sort} onToggle={toggleSort} className="min-w-[100px]" />
            <SortableHeader label="Status" sortKey="status" sort={sort} onToggle={toggleSort} className="min-w-[80px]" />
            <SortableHeader label="Priority" sortKey="priority" sort={sort} onToggle={toggleSort} className="min-w-[70px]" />
            <TableHead className="w-16">Score</TableHead>
            <TableHead className="min-w-[100px]">Assigned To</TableHead>
            <SortableHeader
              label="Value"
              sortKey="estimatedValue"
              sort={sort}
              onToggle={toggleSort}
              icon={<IconCurrencyDollar className="size-3.5" />}
              className="min-w-[70px]"
            />
            <SortableHeader
              label="Created"
              sortKey="createdAt"
              sort={sort}
              onToggle={toggleSort}
              icon={<IconCalendarEvent className="size-3.5" />}
              className="min-w-[80px]"
            />
            <TableHead className="sticky right-0 z-10 w-24 min-w-[80px] bg-background text-right shadow-[-4px_0_8px_-4px_rgb(0_0_0/0.08)] dark:shadow-[-4px_0_8px_-4px_rgb(255_255_255/0.06)]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLeads.map((lead) => {
            const isSelected = selectedIds.has(lead.id);
            const leadScore = scores?.get(lead.id);
            return (
              <TableRow
                key={lead.id}
                className={cn(
                  'cursor-pointer',
                  isSelected && 'bg-muted/50'
                )}
                onClick={() => navigateToLead(lead.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(lead.id)}
                    aria-label={`Select ${lead.fullName}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{lead.fullName}</TableCell>
                <TableCell>
                  {lead.email ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <IconMail className="size-3.5" />
                      {lead.email}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {lead.companyName ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <IconBuilding className="size-3.5" />
                      {lead.companyName}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={cn('font-normal', STATUS_COLORS[lead.status])}>
                    {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      PRIORITY_COLORS[lead.priority]
                    )}
                  >
                    {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}
                  </span>
                </TableCell>
                <TableCell>
                  {leadScore ? (
                    <LeadScoreBadge score={leadScore.score} size="sm" />
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {lead.assignedTo ? (
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(getUserName(lead.assignedTo, '?'))}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground truncate max-w-[100px]">
                        {getUserName(lead.assignedTo)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell className="font-medium tabular-nums">
                  {lead.estimatedValue > 0
                    ? formatCurrency(lead.estimatedValue)
                    : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(lead.createdAt)}
                </TableCell>
                <TableCell className="sticky right-0 z-10 bg-background shadow-[-4px_0_8px_-4px_rgb(0_0_0/0.08)] dark:shadow-[-4px_0_8px_-4px_rgb(255_255_255/0.06)]">
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(lead.id)}
                      aria-label={`Edit ${lead.fullName}`}
                    >
                      <IconEdit className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDelete(lead.id)}
                      aria-label={`Delete ${lead.fullName}`}
                      className="text-destructive hover:text-destructive"
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
});

LeadTable.displayName = 'LeadTable';

function SortableHeader({
  label,
  sortKey,
  sort,
  onToggle,
  icon,
  className,
}: {
  label: string;
  sortKey: LeadSortKey;
  sort: { by: LeadSortKey; dir: 'asc' | 'desc' };
  onToggle: (key: LeadSortKey) => void;
  icon?: ReactNode;
  className?: string;
}) {
  const active = sort.by === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className="inline-flex items-center gap-1 text-foreground transition-colors hover:text-primary"
        aria-label={`Sort by ${label}${active ? `, currently ${sort.dir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
      >
        {icon}
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <IconChevronUp className="size-3.5" />
          ) : (
            <IconChevronDown className="size-3.5" />
          )
        ) : (
          <IconChevronUp className="size-3.5 text-muted-foreground/30" />
        )}
      </button>
    </TableHead>
  );
}

export { LeadTable };
