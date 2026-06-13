export type ViewEntityType = 'lead' | 'contact' | 'company' | 'deal' | 'task' | 'meeting';

export interface SavedView {
  id: string;
  name: string;
  entityType: ViewEntityType;
  filters: Record<string, unknown>;
  sortBy: string | null;
  sortOrder: 'asc' | 'desc' | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedViewFormData {
  name: string;
  entityType: ViewEntityType;
  filters: Record<string, unknown>;
  sortBy?: string | null;
  sortOrder?: 'asc' | 'desc' | null;
}
