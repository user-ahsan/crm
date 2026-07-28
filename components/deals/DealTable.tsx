'use client';

import { memo } from 'react';
import type { Deal, DealStage } from '@/types/deal.types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { USERS } from '@/data/mock-users';
import { formatCurrency, formatDate, getInitials } from '@/lib/formatters';
import { IconEdit, IconTrash, IconCurrencyDollar, IconCalendarEvent } from '@tabler/icons-react';

interface DealTableProps {
  deals: Deal[];
  stages: DealStage[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (id: string) => void;
}

const DealTable = memo(function DealTable({ deals, stages, onEdit, onDelete, onClick }: DealTableProps) {
  const stageMap = new Map(stages.map((s) => [s.id, s]));

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>
              <span className="inline-flex items-center gap-1">
                <IconCalendarEvent className="size-3.5" />
                Close Date
              </span>
            </TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => {
            const stage = deal.stageId ? stageMap.get(deal.stageId) : undefined;
            return (
              <TableRow
                key={deal.id}
                className="cursor-pointer"
                onClick={() => onClick(deal.id)}
              >
                <TableCell className="font-medium">{deal.title}</TableCell>
                <TableCell className="font-medium tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <IconCurrencyDollar className="size-3.5 text-muted-foreground" />
                    {deal.value > 0 ? formatCurrency(deal.value) : '—'}
                  </span>
                </TableCell>
                <TableCell>
                  {stage ? (
                    <Badge
                      variant="outline"
                      className="font-normal"
                      style={{
                        backgroundColor: `${stage.color}20`,
                        color: stage.color,
                        borderColor: `${stage.color}40`,
                      }}
                    >
                      {stage.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {deal.assignedTo ? (
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(
                            USERS.find((u) => u.id === deal.assignedTo)?.name ?? '?',
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground truncate max-w-[100px]">
                        {USERS.find((u) => u.id === deal.assignedTo)?.name ?? '—'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {deal.closeDate ? formatDate(deal.closeDate) : '—'}
                </TableCell>
                <TableCell>
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(deal.id)}
                      aria-label={`Edit ${deal.title}`}
                    >
                      <IconEdit className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDelete(deal.id)}
                      aria-label={`Delete ${deal.title}`}
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

DealTable.displayName = 'DealTable';
export { DealTable };
