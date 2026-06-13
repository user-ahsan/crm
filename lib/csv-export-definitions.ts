/**
 * CSV export column definitions for all CRM entity types.
 * Each definition maps entity fields to human-readable column headers
 * with optional formatters for value transformation.
 */

export interface ExportColumn {
  /** Property key on the data object */
  key: string;
  /** Human-readable column header for the CSV */
  label: string;
  /**
   * Optional formatter function.
   * Receives the raw value and the full row for context.
   * Returns a string for CSV output.
   */
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export const LEAD_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'companyName', label: 'Company' },
  { key: 'industry', label: 'Industry' },
  { key: 'country', label: 'Country' },
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignedTo', label: 'Assigned To' },
  {
    key: 'estimatedValue',
    label: 'Estimated Value',
    format: (v) => `$${((v as number) || 0).toLocaleString()}`,
  },
  {
    key: 'tags',
    label: 'Tags',
    format: (v) => ((v as string[]) || []).join('; '),
  },
  { key: 'notes', label: 'Notes' },
  {
    key: 'createdAt',
    label: 'Created Date',
    format: (v) => {
      if (!v) return '';
      try {
        return new Date(v as string).toLocaleDateString('en-US');
      } catch {
        return String(v);
      }
    },
  },
];

// ─── Contacts ────────────────────────────────────────────────────────────────

export const CONTACT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'companyId', label: 'Company ID' },
  { key: 'location', label: 'Location' },
  {
    key: 'tags',
    label: 'Tags',
    format: (v) => ((v as string[]) || []).join('; '),
  },
  { key: 'notes', label: 'Notes' },
  {
    key: 'createdAt',
    label: 'Created Date',
    format: (v) => {
      if (!v) return '';
      try {
        return new Date(v as string).toLocaleDateString('en-US');
      } catch {
        return String(v);
      }
    },
  },
];

// ─── Companies ───────────────────────────────────────────────────────────────

export const COMPANY_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'industry', label: 'Industry' },
  { key: 'size', label: 'Company Size' },
  {
    key: 'revenue',
    label: 'Revenue',
    format: (v) => `$${((v as number) || 0).toLocaleString()}`,
  },
  { key: 'location', label: 'Location' },
  { key: 'website', label: 'Website' },
  {
    key: 'createdAt',
    label: 'Created Date',
    format: (v) => {
      if (!v) return '';
      try {
        return new Date(v as string).toLocaleDateString('en-US');
      } catch {
        return String(v);
      }
    },
  },
];

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const TASK_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  {
    key: 'dueDate',
    label: 'Due Date',
    format: (v) => {
      if (!v) return '';
      try {
        return new Date(v as string).toLocaleDateString('en-US');
      } catch {
        return String(v);
      }
    },
  },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'relatedToType', label: 'Related Entity Type' },
  { key: 'relatedToId', label: 'Related Entity ID' },
  {
    key: 'createdAt',
    label: 'Created Date',
    format: (v) => {
      if (!v) return '';
      try {
        return new Date(v as string).toLocaleDateString('en-US');
      } catch {
        return String(v);
      }
    },
  },
];

// ─── Meetings ────────────────────────────────────────────────────────────────

export const MEETING_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'title', label: 'Title' },
  {
    key: 'dateTime',
    label: 'Date & Time',
    format: (v) => {
      if (!v) return '';
      try {
        const d = new Date(v as string);
        return d.toLocaleString('en-US', {
          dateStyle: 'short',
          timeStyle: 'short',
        });
      } catch {
        return String(v);
      }
    },
  },
  { key: 'type', label: 'Type' },
  { key: 'duration', label: 'Duration (min)' },
  {
    key: 'participants',
    label: 'Participants',
    format: (v) => ((v as string[]) || []).join('; '),
  },
  { key: 'notes', label: 'Notes' },
  { key: 'outcome', label: 'Outcome' },
  { key: 'relatedToType', label: 'Related Entity Type' },
  { key: 'relatedToId', label: 'Related Entity ID' },
  {
    key: 'createdAt',
    label: 'Created Date',
    format: (v) => {
      if (!v) return '';
      try {
        return new Date(v as string).toLocaleDateString('en-US');
      } catch {
        return String(v);
      }
    },
  },
];

// ─── Entity registry for dynamic lookup ──────────────────────────────────────

export const ENTITY_EXPORT_CONFIG: Record<
  string,
  { columns: ExportColumn[]; label: string }
> = {
  leads: { columns: LEAD_EXPORT_COLUMNS, label: 'Leads' },
  contacts: { columns: CONTACT_EXPORT_COLUMNS, label: 'Contacts' },
  companies: { columns: COMPANY_EXPORT_COLUMNS, label: 'Companies' },
  tasks: { columns: TASK_EXPORT_COLUMNS, label: 'Tasks' },
  meetings: { columns: MEETING_EXPORT_COLUMNS, label: 'Meetings' },
} as const;
