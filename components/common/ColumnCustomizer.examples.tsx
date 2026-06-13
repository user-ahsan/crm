'use client';

/**
 * Integration examples for ColumnCustomizer + useColumnManager.
 *
 * These are NOT production stories — they demonstrate real usage patterns you
 * can adapt in your own table components.
 *
 * ─── Pattern 1: Standalone component (with localStorage) ──────────────────
 *
 *   <ColumnCustomizer
 *     columns={columns}
 *     onChange={setColumns}
 *     storageKey="leads-table-columns"
 *   />
 *
 * ─── Pattern 2: Hook-based (recommended — single source of truth) ────────
 *
 *   const { visibleColumns, customizerProps } = useColumnManager(
 *     'leads-table-columns',
 *     LEAD_COLUMNS,
 *   );
 *
 *   return (
 *     <div>
 *       <TableToolbar>
 *         <ColumnCustomizer {...customizerProps} />
 *       </TableToolbar>
 *
 *       <Table>
 *         <TableHeader>
 *           <TableRow>
 *             {visibleColumns.map((col) => (
 *               <TableHead key={col.id}>{col.label}</TableHead>
 *             ))}
 *           </TableRow>
 *         </TableHeader>
 *         <TableBody>
 *           {rows.map((row) => (
 *             <TableRow key={row.id}>
 *               {visibleColumns.map((col) => (
 *                 <TableCell key={col.id}>
 *                   {row[col.id as keyof typeof row]}
 *                 </TableCell>
 *               ))}
 *             </TableRow>
 *           ))}
 *         </TableBody>
 *       </Table>
 *     </div>
 *   );
 */

// ─── Example column definitions ────────────────────────────────────────────

import type { ColumnDef } from './ColumnCustomizer';

/**
 * Example column set for a leads table. Copy this shape in your own feature
 * modules and tweak the `id` / `label` / `defaultVisible` values.
 */
export const LEAD_TABLE_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Name', visible: true, defaultVisible: true },
  { id: 'email', label: 'Email', visible: true, defaultVisible: true },
  { id: 'phone', label: 'Phone', visible: true, defaultVisible: true },
  { id: 'company', label: 'Company', visible: true, defaultVisible: true },
  { id: 'status', label: 'Status', visible: true, defaultVisible: true },
  { id: 'priority', label: 'Priority', visible: true, defaultVisible: true },
  { id: 'source', label: 'Source', visible: false, defaultVisible: false },
  { id: 'owner', label: 'Owner', visible: true, defaultVisible: true },
  { id: 'createdAt', label: 'Created', visible: true, defaultVisible: true },
  {
    id: 'lastContactedAt',
    label: 'Last Contacted',
    visible: false,
    defaultVisible: false,
  },
  { id: 'tags', label: 'Tags', visible: false, defaultVisible: false },
];

/**
 * Example column set for a contacts table.
 */
export const CONTACT_TABLE_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Name', visible: true, defaultVisible: true },
  { id: 'email', label: 'Email', visible: true, defaultVisible: true },
  { id: 'phone', label: 'Phone', visible: true, defaultVisible: true },
  { id: 'company', label: 'Company', visible: true, defaultVisible: true },
  { id: 'title', label: 'Job Title', visible: true, defaultVisible: true },
  {
    id: 'lastContactedAt',
    label: 'Last Contacted',
    visible: false,
    defaultVisible: false,
  },
  { id: 'owner', label: 'Owner', visible: true, defaultVisible: true },
  { id: 'createdAt', label: 'Created', visible: true, defaultVisible: true },
];

// ─── Usage snippet (paste into your own table component) ───────────────────
/*
import { ColumnCustomizer } from '@/components/common/ColumnCustomizer';
import { useColumnManager } from '@/components/common/useColumnManager';
import { LEAD_TABLE_COLUMNS } from '@/components/common/ColumnCustomizer.examples';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export function LeadsTable() {
  const {
    visibleColumns,
    customizerProps,
    resetColumns,
  } = useColumnManager('leads-table-columns', LEAD_TABLE_COLUMNS);

  const { data, isLoading, error } = useLeads(); // your data-fetching hook

  // ── Loading state ──
  if (isLoading) {
    return <TableSkeleton columns={visibleColumns.length} rows={8} />;
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-destructive">Failed to load leads.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  // ── Empty state ──
  if (!data || data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Leads</h2>
          <ColumnCustomizer {...customizerProps} />
        </div>
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <IconUsers className="size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No leads yet.</p>
        </div>
      </div>
    );
  }

  // ── Data state ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Leads</h2>
        <ColumnCustomizer {...customizerProps} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {visibleColumns.map((col) => (
              <TableHead key={col.id}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((lead) => (
            <TableRow key={lead.id}>
              {visibleColumns.map((col) => (
                <TableCell key={col.id}>
                  {String(lead[col.id as keyof typeof lead] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
*/
