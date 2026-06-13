'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Lead } from '@/types/lead.types';
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
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  IconEdit,
  IconTrash,
  IconUsers,
  IconCurrencyDollar,
  IconCalendarEvent,
  IconMail,
  IconBuilding,
} from '@tabler/icons-react';

interface LeadTableProps {
  leads: Lead[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function LeadTable({ leads, onEdit, onDelete }: LeadTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  }, [leads, selectedIds.size]);

  const isAllSelected = leads.length > 0 && selectedIds.size === leads.length;

  const navigateToLead = useCallback(
    (id: string) => {
      router.push(`/leads/${id}`);
    },
    [router]
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
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>
              <span className="inline-flex items-center gap-1">
                <IconCurrencyDollar className="size-3.5" />
                Value
              </span>
            </TableHead>
            <TableHead>
              <span className="inline-flex items-center gap-1">
                <IconCalendarEvent className="size-3.5" />
                Created
              </span>
            </TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const isSelected = selectedIds.has(lead.id);
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
                <TableCell className="font-medium tabular-nums">
                  {lead.estimatedValue > 0
                    ? formatCurrency(lead.estimatedValue)
                    : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(lead.createdAt)}
                </TableCell>
                <TableCell>
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
}
