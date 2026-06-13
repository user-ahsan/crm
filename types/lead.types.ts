export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
export type LeadPriority = 'low' | 'medium' | 'high';
export type LeadSource = 'manual' | 'website' | 'referral' | 'ads' | 'social';

export interface Lead {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  industry?: string;
  country?: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  assignedTo?: string;
  createdBy?: string;
  updatedBy?: string;
  estimatedValue: number;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFormData {
  fullName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  industry?: string;
  country?: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  assignedTo?: string;
  estimatedValue: number;
  tags: string[];
  notes?: string;
}

export interface LeadFilters {
  search?: string;
  status?: LeadStatus | '';
  source?: LeadSource | '';
  priority?: LeadPriority | '';
  assignedTo?: string;
  minScore?: number;
}
