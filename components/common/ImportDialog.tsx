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
 * Parses a CSV string into headers and rows, handling quoted fields.
 */
function parseCSV(content: string): ParsedCSV {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          current += '"';
          i++; // skip escaped quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  const totalRows = rows.length;

  return { headers, rows, totalRows };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ImportDialog({
  open,
  onOpenChange,
  entityType: _entityType,
  entityLabel,
  onImportComplete,
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCSV | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

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

  /** Simulated import */
  const handleImport = useCallback(async () => {
    if (!parsed) return;

    setImporting(true);
    setError(null);

    try {
      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate import: most rows succeed, some fail randomly
      const mockErrors: ImportResult['errors'] = [];
      let errorCount = 0;

      for (let i = 0; i < parsed.totalRows; i++) {
        // Simulate ~10% failure rate for demo realism
        if (Math.random() < 0.1 && errorCount < 3) {
          mockErrors.push({
            row: i + 2, // +2 because row 1 is header, 0-indexed
            message: `Invalid data in column "${parsed.headers[0] ?? 'unknown'}"`,
          });
          errorCount++;
        }
      }

      const importedCount = parsed.totalRows - mockErrors.length;
      const importResult: ImportResult = {
        imported: importedCount,
        errors: mockErrors,
      };

      setResult(importResult);

      if (mockErrors.length === 0) {
        toast.success(`Successfully imported ${importedCount} ${entityLabel.toLowerCase()}`);
      } else {
        toast.warning(
          `Imported ${importedCount} ${entityLabel.toLowerCase()} with ${mockErrors.length} error(s)`,
        );
      }

      onImportComplete?.();
    } catch {
      const message = 'An unexpected error occurred during import.';
      setError(message);
      toast.error(message);
    } finally {
      setImporting(false);
    }
  }, [parsed, entityLabel, onImportComplete]);

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
