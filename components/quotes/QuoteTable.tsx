'use client';

import type { Quote, QuoteStatus } from '@/types/quote.types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconDotsVertical, IconEdit, IconFileInvoice, IconTrash } from '@tabler/icons-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

interface QuoteTableProps {
  quotes: Quote[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: QuoteStatus) => void;
  onGenerateInvoice?: (quote: Quote) => void;
}

export function QuoteTable({ quotes, onEdit, onDelete, onStatusChange, onGenerateInvoice }: QuoteTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Valid Until</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((quote) => (
            <TableRow
              key={quote.id}
              className="cursor-pointer"
              onClick={() => onEdit(quote.id)}
            >
              <TableCell className="font-medium">{quote.title}</TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[quote.status]} variant="secondary">
                  {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(quote.total)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {quote.validUntil ? formatDate(quote.validUntil) : '-'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(quote.createdAt)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} className="inline-flex shrink-0 items-center justify-center rounded-md size-8 hover:bg-accent hover:text-accent-foreground">
                    <IconDotsVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => onEdit(quote.id)}>
                      <IconEdit className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                    {quote.status === 'draft' && (
                      <DropdownMenuItem onClick={() => onStatusChange(quote.id, 'sent')}>
                        Mark as Sent
                      </DropdownMenuItem>
                    )}
                    {quote.status === 'accepted' && onGenerateInvoice && (
                      <DropdownMenuItem onClick={() => onGenerateInvoice(quote)}>
                        <IconFileInvoice className="mr-2 size-4" />
                        Generate Invoice
                      </DropdownMenuItem>
                    )}
                    {quote.status === 'sent' && (
                      <>
                        <DropdownMenuItem onClick={() => onStatusChange(quote.id, 'accepted')}>
                          Mark as Accepted
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onStatusChange(quote.id, 'rejected')}>
                          Mark as Rejected
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(quote.id)}
                    >
                      <IconTrash className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
