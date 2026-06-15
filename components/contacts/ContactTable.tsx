'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Contact } from '@/types/contact.types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { companies } from '@/data/companies';
import {
  IconEdit,
  IconTrash,
  IconUsers,
  IconMail,
  IconPhone,
  IconBriefcase,
  IconBuilding,
} from '@tabler/icons-react';

interface ContactTableProps {
  contacts: Contact[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function ContactTable({ contacts, onEdit, onDelete, selectedIds: externalSelectedIds, onSelectionChange }: ContactTableProps) {
  const router = useRouter();
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = externalSelectedIds ?? internalSelectedIds;

  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

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

  const navigateToContact = useCallback(
    (id: string) => {
      router.push(`/contacts/${id}`);
    },
    [router]
  );

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
          <IconUsers className="size-8 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-base font-medium text-foreground">No contacts found</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          There are no contacts to display yet. Create your first contact to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{selectedIds.size}</span>
          {selectedIds.size === 1 ? 'contact' : 'contacts'} selected
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead className="min-w-[140px]">Name</TableHead>
            <TableHead className="min-w-[180px]">Email</TableHead>
            <TableHead className="min-w-[130px]">Phone</TableHead>
            <TableHead className="min-w-[120px]">Job Title</TableHead>
            <TableHead className="min-w-[120px]">Company</TableHead>
            <TableHead className="min-w-[100px]">Tags</TableHead>
            <TableHead className="min-w-[90px]">Linked Leads</TableHead>
            {(onEdit || onDelete) && (
              <TableHead className="w-24 min-w-[80px] text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => {
            const isSelected = selectedIds.has(contact.id);
            return (
              <TableRow
                key={contact.id}
                className={cn('cursor-pointer', isSelected && 'bg-muted/50')}
                onClick={() => navigateToContact(contact.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(contact.id)}
                    aria-label={`Select ${contact.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{contact.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {contact.email ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <IconMail className="size-3.5 shrink-0" />
                      <span className="truncate max-w-[160px]">{contact.email}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {contact.phone ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <IconPhone className="size-3.5 shrink-0" />
                      <span className="truncate max-w-[140px]">{contact.phone}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {contact.jobTitle ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <IconBriefcase className="size-3.5 shrink-0" />
                      {contact.jobTitle}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {contact.companyId && companyMap.has(contact.companyId) ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <IconBuilding className="size-3.5 shrink-0" />
                      {companyMap.get(contact.companyId)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.length > 0 ? (
                      contact.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                    {contact.tags.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{contact.tags.length - 3}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="tabular-nums text-muted-foreground">
                    {contact.leadIds.length > 0 ? contact.leadIds.length : '—'}
                  </span>
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
                          onClick={() => onEdit(contact.id)}
                          aria-label={`Edit ${contact.name}`}
                        >
                          <IconEdit className="size-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onDelete(contact.id)}
                          aria-label={`Delete ${contact.name}`}
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
}

export default ContactTable;
