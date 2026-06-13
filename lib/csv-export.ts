/**
 * CSV export utility for the CRM system.
 * Provides functions to convert data to CSV and trigger file downloads.
 */

/**
 * Escapes a CSV value, wrapping in quotes if it contains special characters.
 * Handles commas, double-quotes, and newlines.
 */
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts an array of objects into a CSV string with a header row.
 *
 * @param data - Array of flat data objects to export.
 * @param columns - Column definitions with key (property name) and label (header text).
 * @returns A CSV-formatted string with BOM for Excel UTF-8 compatibility.
 */
export function convertToCSV<T extends Record<string, any> = Record<string, any>>(
  data: T[],
  columns: { key: string; label: string }[],
): string {
  if (columns.length === 0) {
    return '';
  }

  // Header row
  const header = columns.map((col) => escapeCsvValue(col.label)).join(',');

  // Data rows
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key];
        if (value === null || value === undefined) {
          return '';
        }
        if (value instanceof Date) {
          return escapeCsvValue(value.toLocaleDateString('en-US'));
        }
        return escapeCsvValue(String(value));
      })
      .join(','),
  );

  return [header, ...rows].join('\r\n');
}

/**
 * Triggers a browser download of a CSV file.
 * Prepends a UTF-8 BOM for Excel compatibility with special characters.
 *
 * @param csv - The CSV string content to download.
 * @param filename - The desired filename (e.g. 'leads-export-2026-06-13.csv').
 */
export function downloadCSV(csv: string, filename: string): void {
  // BOM for UTF-8 — ensures Excel opens the file correctly
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // Clean up
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
