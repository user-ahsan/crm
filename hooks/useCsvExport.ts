'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { convertToCSV, downloadCSV } from '@/lib/csv-export';
import { ENTITY_EXPORT_CONFIG } from '@/lib/csv-export-definitions';
import type { ExportColumn } from '@/lib/csv-export-definitions';

/** Small delay helper to space out sequential downloads */
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Generic CSV export helper. Writes typed data to a CSV file and triggers download.
 */
function exportToCsv<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns: ExportColumn[],
): void {
  const mappedData = data.map((item) => {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      const rawValue = item[col.key];
      row[col.key] = col.format ? col.format(rawValue, item) : rawValue;
    }
    return row;
  });
  const csv = convertToCSV(mappedData, columns);
  downloadCSV(csv, filename);
}

/**
 * Custom hook for CSV export operations.
 * Dynamically imports the required service, fetches data,
 * applies column formatters, generates the CSV, and triggers a download.
 */
export function useCsvExport() {
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Exports a single entity type to CSV and downloads it.
   * Internal helper — does NOT manage isExporting state.
   */
  const exportSingle = useCallback(async (entityType: string): Promise<void> => {
    const config = ENTITY_EXPORT_CONFIG[entityType];
    if (!config) {
      throw new Error(`Unknown entity type: "${entityType}"`);
    }

    const { columns } = config;
    const today = new Date().toISOString().slice(0, 10);
    const filename = `${entityType}-export-${today}.csv`;

    switch (entityType) {
      case 'leads': {
        const { leadService } = await import('@/services/lead.service');
        const data = await leadService.getAll();
        exportToCsv(data, filename, columns);
        break;
      }
      case 'contacts': {
        const { contactService } = await import('@/services/contact.service');
        const data = await contactService.getAll();
        exportToCsv(data, filename, columns);
        break;
      }
      case 'companies': {
        const { companyService } = await import('@/services/company.service');
        const data = await companyService.getAll();
        exportToCsv(data, filename, columns);
        break;
      }
      case 'tasks': {
        const { taskService } = await import('@/services/task.service');
        const data = await taskService.getAll();
        exportToCsv(data, filename, columns);
        break;
      }
      case 'meetings': {
        const { meetingService } = await import('@/services/meeting.service');
        const data = await meetingService.getAll();
        exportToCsv(data, filename, columns);
        break;
      }
      default:
        throw new Error(`Unhandled entity type: "${entityType}"`);
    }
  }, []);

  /**
   * Exports one or all entity types.
   * Manages the isExporting loading state and toast notifications.
   */
  const exportEntity = useCallback(
    async (entityType: string) => {
      setIsExporting(true);
      try {
        if (entityType === 'all') {
          // Export each entity type sequentially with a small delay
          const allTypes = ['leads', 'contacts', 'companies', 'tasks', 'meetings'];
          for (const type of allTypes) {
            await exportSingle(type);
            // Small delay between downloads so the browser can handle them
            await delay(500);
          }
          toast.success('All data exported successfully');
        } else {
          await exportSingle(entityType);
          const label = ENTITY_EXPORT_CONFIG[entityType]?.label ?? entityType;
          toast.success(`${label} exported successfully`);
        }
      } catch (err) {
        const label =
          entityType === 'all'
            ? 'All data'
            : (ENTITY_EXPORT_CONFIG[entityType]?.label ?? entityType);
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to export ${label}: ${message}`);
      } finally {
        setIsExporting(false);
      }
    },
    [exportSingle],
  );

  return { exportEntity, isExporting };
}
