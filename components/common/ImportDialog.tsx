'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { IconUpload, IconFileDescription, IconAlertTriangle, IconCircleCheck, IconX, IconLoader } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ─── Column Definitions for Format Guide ─────────────────────────────────

interface ColumnSpec {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example: string;
}

type ImportEntityType = 'leads' | 'contacts' | 'companies' | 'tasks' | 'meetings';

const ENTITY_COLUMNS: Record<string, ColumnSpec[]> = {
  leads: [
    { name: 'fullName', type: 'text', required: true, description: 'Lead full name', example: 'John Davis' },
    { name: 'email', type: 'email', required: false, description: 'Email address', example: 'john@acme.com' },
    { name: 'phone', type: 'text', required: false, description: 'Phone number', example: '+1 (555) 123-4567' },
    { name: 'companyName', type: 'text', required: false, description: 'Company name', example: 'Acme Corp' },
    { name: 'industry', type: 'text', required: false, description: 'Industry vertical', example: 'Technology' },
    { name: 'country', type: 'text', required: false, description: 'Country/region', example: 'United States' },
    { name: 'source', type: 'text', required: false, description: 'Lead source: manual, website, referral, ads, social', example: 'website' },
    { name: 'status', type: 'text', required: false, description: 'Pipeline status: new, contacted, qualified, proposal, won, lost', example: 'new' },
    { name: 'priority', type: 'text', required: false, description: 'Priority: low, medium, high', example: 'medium' },
    { name: 'assignedTo', type: 'text', required: false, description: 'Assigned user ID', example: 'user-1' },
    { name: 'estimatedValue', type: 'number', required: false, description: 'Deal value in USD', example: '25000' },
    { name: 'tags', type: 'text', required: false, description: 'Comma-separated tags', example: 'tech,enterprise' },
    { name: 'notes', type: 'text', required: false, description: 'Internal notes', example: 'Interested in enterprise plan' },
  ],
  contacts: [
    { name: 'name', type: 'text', required: true, description: 'Contact full name', example: 'John Davis' },
    { name: 'email', type: 'email', required: false, description: 'Email address', example: 'john@acme.com' },
    { name: 'phone', type: 'text', required: false, description: 'Phone number', example: '+1 (555) 123-4567' },
    { name: 'jobTitle', type: 'text', required: false, description: 'Job position', example: 'CTO' },
    { name: 'companyId', type: 'text', required: false, description: 'Associated company ID', example: 'company-001' },
    { name: 'location', type: 'text', required: false, description: 'Geographic location', example: 'San Francisco, CA' },
    { name: 'tags', type: 'text', required: false, description: 'Comma-separated tags', example: 'decision-maker,tech' },
    { name: 'notes', type: 'text', required: false, description: 'Internal notes', example: 'Key decision maker' },
  ],
  companies: [
    { name: 'name', type: 'text', required: true, description: 'Company name', example: 'Acme Corp' },
    { name: 'industry', type: 'text', required: false, description: 'Industry vertical', example: 'Technology' },
    { name: 'size', type: 'text', required: false, description: 'Company size: 1-10, 11-50, 51-200, 201-1000, 1000+', example: '201-1000' },
    { name: 'revenue', type: 'number', required: false, description: 'Annual revenue in USD', example: '50000000' },
    { name: 'location', type: 'text', required: false, description: 'Headquarters location', example: 'San Francisco, CA' },
    { name: 'website', type: 'text', required: false, description: 'Company website URL', example: 'https://acme.com' },
  ],
  tasks: [
    { name: 'title', type: 'text', required: true, description: 'Task title', example: 'Send proposal to Acme Corp' },
    { name: 'description', type: 'text', required: false, description: 'Detailed description', example: 'Send enterprise proposal package' },
    { name: 'relatedToType', type: 'text', required: false, description: 'Related entity: lead, contact, company', example: 'lead' },
    { name: 'relatedToId', type: 'text', required: false, description: 'Related entity ID', example: 'lead-001' },
    { name: 'assignedTo', type: 'text', required: false, description: 'Assigned user ID', example: 'user-1' },
    { name: 'dueDate', type: 'text', required: false, description: 'Due date (ISO format)', example: '2026-06-15T17:00:00Z' },
    { name: 'priority', type: 'text', required: false, description: 'Priority: low, medium, high, critical', example: 'high' },
  ],
  meetings: [
    { name: 'title', type: 'text', required: true, description: 'Meeting title', example: 'Enterprise Demo - Acme Corp' },
    { name: 'dateTime', type: 'text', required: true, description: 'Date & time (ISO format)', example: '2026-06-15T10:00:00Z' },
    { name: 'duration', type: 'number', required: false, description: 'Duration in minutes', example: '60' },
    { name: 'type', type: 'text', required: false, description: 'Meeting type: online, offline, call', example: 'online' },
    { name: 'relatedToType', type: 'text', required: false, description: 'Related entity: lead, contact, company', example: 'lead' },
    { name: 'relatedToId', type: 'text', required: false, description: 'Related entity ID', example: 'lead-001' },
    { name: 'participants', type: 'text', required: false, description: 'Comma-separated participant names', example: 'John Davis,Alice Johnson' },
    { name: 'notes', type: 'text', required: false, description: 'Meeting notes', example: 'Demo of enterprise features' },
  ],
};

/**
 * Validates that all required columns for the given entity type are present in the CSV headers.
 * Returns an error message if columns are missing, or null if valid.
 */
function validateRequiredColumns(entityType: string, headers: string[]): string | null {
  const required = ENTITY_COLUMNS[entityType]?.filter(c => c.required).map(c => c.name) ?? [];
  const missing = required.filter(r => !headers.some(h => h.trim().toLowerCase() === r.toLowerCase()));
  if (missing.length > 0) {
    return `Missing required columns: ${missing.join(', ')}`;
  }
  return null;
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface ParsedCSV {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

interface ImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Entity type key (e.g. 'leads', 'contacts') */
  entityType: string;
  /** Display label for the entity (e.g. 'Leads', 'Contacts') */
  entityLabel: string;
  /** Optional callback after import completes */
  onImportComplete?: () => void;
}

// ─── Simple CSV Parser ──────────────────────────────────────────────────────

/**
 * Parses a CSV string into headers and rows, handling multi-line quoted fields (RFC 4180).
 */
function parseCSV(content: string): ParsedCSV {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\n' && !inQuotes) {
      if (current.trim().length > 0) {
        lines.push(current);
      }
      current = '';
    } else if (char === '\r' && !inQuotes) {
      // skip CR, handle CRLF
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) {
    lines.push(current);
  }

  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const nx = line[i + 1];
      if (ch === '"') {
        if (inQ && nx === '"') { field += '"'; i++; }
        else { inQ = !inQ; }
      } else if (ch === ',' && !inQ) {
        fields.push(field);
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field);
    return fields;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows, totalRows: rows.length };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ImportDialog({
  open,
  onOpenChange,
  entityType,
  entityLabel,
  onImportComplete,
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCSV | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Column specs for the current entity type — shows users exact format expected */
  const columns = ENTITY_COLUMNS[entityType] ?? ENTITY_COLUMNS.leads;

  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Reset all internal state (except result) */
  const resetState = useCallback(() => {
    setFile(null);
    setParsed(null);
    setError(null);
    setResult(null);
    setImporting(false);
    setIsDragging(false);
  }, []);

  /** Handle dialog close — reset state */
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        resetState();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, resetState],
  );

  /** Process a selected file */
  const processFile = useCallback((selectedFile: File) => {
    setError(null);
    setResult(null);

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a valid .csv file.');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content || content.trim().length === 0) {
        setError('The selected file is empty.');
        return;
      }

      try {
        const parsedData = parseCSV(content);
        if (parsedData.headers.length === 0) {
          setError('Unable to parse CSV — no headers found.');
          return;
        }

        const colError = validateRequiredColumns(entityType, parsedData.headers);
        if (colError) {
          setError(colError);
          return;
        }

        setFile(selectedFile);
        setParsed(parsedData);
      } catch {
        setError('Failed to parse the CSV file. Please check the format.');
      }
    };
    reader.onerror = () => {
      setError('Failed to read the file. Please try again.');
    };
    reader.readAsText(selectedFile);
  }, [entityType]);

  /** File input change handler */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        processFile(selectedFile);
      }
    },
    [processFile],
  );

  /** Drag events */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) {
        processFile(droppedFile);
      }
    },
    [processFile],
  );

  /** Production import with real validation */
  const handleImport = useCallback(async () => {
    if (!parsed) return;

    setImporting(true);
    setError(null);

    try {
      // Validate all rows before importing
      const errors: ImportResult['errors'] = [];
      for (let i = 0; i < parsed.totalRows; i++) {
        const row = parsed.rows[i];
        for (let j = 0; j < parsed.headers.length; j++) {
          if (!row[j] || row[j].trim() === '') {
            const col = parsed.headers[j];
            const colSpec = columns.find((c) => c.name.toLowerCase() === col.toLowerCase());
            if (colSpec?.required) {
              errors.push({
                row: i + 2,
                message: `Missing required value in column "${col}"`,
              });
            }
          }
        }
      }

      if (errors.length > 0) {
        setError(`Found ${errors.length} validation error(s). Please fix and re-upload.`);
        toast.error(`Import failed: ${errors.length} row(s) have missing required fields.`);
        setResult({ imported: 0, errors });
        setImporting(false);
        return;
      }

      // All rows valid — call the appropriate service
      const serviceMap: Record<string, { create: (data: any) => Promise<any> }> = {
        leads: (await import('@/services/lead.service')).leadService,
        contacts: (await import('@/services/contact.service')).contactService,
        companies: (await import('@/services/company.service')).companyService,
        tasks: (await import('@/services/task.service')).taskService,
        meetings: (await import('@/services/meeting.service')).meetingService,
      };

      const service = serviceMap[entityType];
      if (!service) {
        throw new Error(`Unknown entity type: ${entityType}`);
      }

      let importedCount = 0;
      const importErrors: ImportResult['errors'] = [];

      for (let i = 0; i < parsed.totalRows; i++) {
        try {
          const rowData: Record<string, string> = {};
          parsed.headers.forEach((header, idx) => {
            rowData[header] = parsed.rows[i][idx] || '';
          });
          await service.create(rowData);
          importedCount++;
        } catch (e) {
          importErrors.push({
            row: i + 2,
            message: e instanceof Error ? e.message : 'Import failed',
          });
        }
      }

      const importResult: ImportResult = {
        imported: importedCount,
        errors: importErrors,
      };

      setResult(importResult);
      if (importErrors.length > 0) {
        toast.warning(`Imported ${importedCount} ${entityLabel.toLowerCase()} with ${importErrors.length} error(s).`);
      } else {
        toast.success(`Successfully imported ${importedCount} ${entityLabel.toLowerCase()}.`);
      }

      onImportComplete?.();
    } catch {
      const message = 'An unexpected error occurred during import.';
      setError(message);
      toast.error(message);
    } finally {
      setImporting(false);
    }
  }, [parsed, entityLabel, onImportComplete, columns]);

  /** Preview rows (first 3) */
  const previewRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.slice(0, 3);
  }, [parsed]);

  const hasFile = file !== null;
  const canImport = parsed !== null && parsed.totalRows > 0 && !importing;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import {entityLabel} from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk-import {entityLabel.toLowerCase()}.
            The file must have a header row matching the expected columns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Format Guide ─────────────────────────── */}
          {!hasFile && (
            <details className="group rounded-xl border border-border bg-muted/30">
              <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <IconFileDescription className="size-4 shrink-0" />
                <span>CSV format guide — what columns to use</span>
                <span className="ml-auto text-[10px] text-muted-foreground/50 group-open:hidden">Expand</span>
                <span className="ml-auto text-[10px] text-muted-foreground/50 hidden group-open:inline">Collapse</span>
              </summary>
              <div className="border-t border-border px-3 pb-3 pt-2">
                <p className="mb-2 text-xs text-muted-foreground">
                  Your CSV header row must use these column names. <span className="font-medium text-destructive">*</span> = required.
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full table-auto text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="whitespace-nowrap px-2.5 py-1.5 font-medium text-muted-foreground">Column</th>
                        <th className="whitespace-nowrap px-2.5 py-1.5 font-medium text-muted-foreground">Type</th>
                        <th className="whitespace-nowrap px-2.5 py-1.5 font-medium text-muted-foreground">Req</th>
                        <th className="px-2.5 py-1.5 font-medium text-muted-foreground">Description</th>
                        <th className="px-2.5 py-1.5 font-medium text-muted-foreground">Example</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columns.map((col) => (
                        <tr key={col.name} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                          <td className="whitespace-nowrap px-2.5 py-1 font-mono text-[10px] font-medium">
                            {col.name}
                            {col.required && <span className="text-destructive">*</span>}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-1 text-muted-foreground">{col.type}</td>
                          <td className="px-2.5 py-1">
                            {col.required ? (
                              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] font-medium text-destructive">Yes</span>
                            ) : (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="px-2.5 py-1 text-muted-foreground">{col.description}</td>
                          <td className="max-w-[100px] truncate px-2.5 py-1 font-mono text-[10px] text-muted-foreground">{col.example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Row example: <code className="rounded bg-muted/70 px-1 py-0.5 font-mono text-[9px]">{columns.slice(0, 3).map((c) => c.example).join(',')}{columns.length > 3 ? ',...' : ''}</code>
                </p>
              </div>
            </details>
          )}

          {/* Upload area — only show when no file is loaded or after reset */}
          {!hasFile && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-8 text-center transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30',
              )}
            >
              <IconUpload className="size-8 text-muted-foreground" />
              <div className="text-sm font-medium">
                {isDragging ? 'Drop file here' : 'Drop CSV file here, or click to browse'}
              </div>
              <p className="text-xs text-muted-foreground">Accepts .csv files only</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* File info & preview */}
          {hasFile && parsed && (
            <>
              {/* Selected file info */}
              <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3">
                <IconFileDescription className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {parsed.totalRows} row{parsed.totalRows !== 1 ? 's' : ''} detected
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setFile(null);
                    setParsed(null);
                    setResult(null);
                    setError(null);
                  }}
                  disabled={importing}
                  aria-label="Remove file"
                >
                  <IconX className="size-4" />
                </Button>
              </div>

              {/* Column preview */}
              {parsed.headers.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Detected columns ({parsed.headers.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.headers.map((header, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        {header}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Data preview (first 3 rows) */}
              {previewRows.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Preview (first {Math.min(previewRows.length, parsed.totalRows)} of{' '}
                    {parsed.totalRows} rows)
                  </p>
                  <div className="max-h-32 overflow-auto rounded-2xl border">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {parsed.headers.slice(0, 6).map((header, i) => (
                            <th key={i} className="px-3 py-1.5 font-medium text-muted-foreground">
                              {header}
                            </th>
                          ))}
                          {parsed.headers.length > 6 && (
                            <th className="px-3 py-1.5 font-medium text-muted-foreground">
                              +{parsed.headers.length - 6} more
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-b last:border-b-0">
                            {row.slice(0, 6).map((cell, cellIdx) => (
                              <td key={cellIdx} className="max-w-[120px] truncate px-3 py-1.5">
                                {cell}
                              </td>
                            ))}
                            {parsed.headers.length > 6 && (
                              <td className="px-3 py-1.5 text-muted-foreground">...</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import results */}
              {result && (
                <div className="space-y-2 rounded-2xl border p-3">
                  <div className="flex items-center gap-3">
                    <IconCircleCheck className="size-5 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium">
                      {result.imported} record{result.imported !== 1 ? 's' : ''} imported
                    </span>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <IconAlertTriangle className="size-4" />
                        <span className="font-medium">
                          {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <ul className="ml-6 list-disc space-y-0.5 text-xs text-muted-foreground">
                        {result.errors.map((err, i) => (
                          <li key={i}>
                            Row {err.row}: {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose render={<Button variant="outline" />}>
            {result ? 'Close' : 'Cancel'}
          </DialogClose>

          {hasFile && !result && (
            <Button onClick={handleImport} disabled={!canImport}>
              {importing && <IconLoader className="size-4 animate-spin" />}
              {importing ? 'Importing...' : `Import ${entityLabel}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportDialog;
