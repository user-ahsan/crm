export type CompanySize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';

export interface Company {
  id: string;
  name: string;
  industry?: string;
  size?: CompanySize;
  revenue: number;
  location?: string;
  website?: string;
  contactIds: string[];
  leadIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyFormData {
  name: string;
  industry?: string;
  size?: CompanySize;
  revenue: number;
  location?: string;
  website?: string;
  tags?: string[];
}

/**
 * Filter shape for company list queries (SERVICES.md / MODULES.md contract).
 * - search: case-insensitive substring match on company name
 * - industry: exact match
 * - size: exact match; `''` is the "no filter" sentinel used by filter UIs
 */
export interface CompanyFilters {
  search?: string;
  industry?: string;
  size?: CompanySize | '';
}
