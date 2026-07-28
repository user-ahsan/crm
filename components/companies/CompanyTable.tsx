'use client';

import { useState, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import type { Company } from '@/types/company.types';
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
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  IconEdit,
  IconTrash,
  IconBuilding,
  IconCurrencyDollar,
  IconUsers,
  IconTrendingUp,
  IconMapPin,
} from '@tabler/icons-react';

interface CompanyTableProps {
  companies: Company[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

const CompanyTable = memo(function CompanyTable({ companies, onEdit, onDelete, selectedIds: externalSelectedIds, onSelectionChange }: CompanyTableProps) {
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

  const navigateToCompany = useCallback(
    (id: string) => {
      router.push(`/companies/${id}`);
    },
    [router]
  );

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
          <IconBuilding className="size-8 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-base font-medium text-foreground">No companies found</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          There are no companies to display yet. Create your first company to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{selectedIds.size}</span>
          {selectedIds.size === 1 ? 'company' : 'companies'} selected
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Name</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>
              <span className="inline-flex items-center gap-1">
                <IconCurrencyDollar className="size-3.5" />
                Revenue
              </span>
            </TableHead>
            <TableHead>
              <span className="inline-flex items-center gap-1">
                <IconUsers className="size-3.5" />
                Contacts
              </span>
            </TableHead>
            <TableHead>
              <span className="inline-flex items-center gap-1">
                <IconTrendingUp className="size-3.5" />
                Leads
              </span>
            </TableHead>
            {(onEdit || onDelete) && (
              <TableHead className="w-24 text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => {
            const isSelected = selectedIds.has(company.id);
            return (
              <TableRow
                key={company.id}
                className={cn('cursor-pointer', isSelected && 'bg-muted/50')}
                onClick={() => navigateToCompany(company.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(company.id)}
                    aria-label={`Select ${company.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{company.name}</TableCell>
                <TableCell>
                  {company.industry ? (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {company.industry}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {company.size ? (
                    <span className="text-sm text-muted-foreground">{company.size}</span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {company.location ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <IconMapPin className="size-3.5 shrink-0" />
                      <span className="truncate max-w-[150px]">{company.location}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell className="font-medium tabular-nums">
                  {company.revenue > 0
                    ? formatCurrency(company.revenue)
                    : '—'}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {company.contactIds.length > 0 ? company.contactIds.length : '—'}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {company.leadIds.length > 0 ? company.leadIds.length : '—'}
                </TableCell>
                {(onEdit || onDelete) && (
                  <TableCell>
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(company.id)}
                          aria-label={`Edit ${company.name}`}
                        >
                          <IconEdit className="size-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onDelete(company.id)}
                          aria-label={`Delete ${company.name}`}
                          className="text-destructive hover:text-destructive"
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
});

CompanyTable.displayName = 'CompanyTable';
export default CompanyTable;
