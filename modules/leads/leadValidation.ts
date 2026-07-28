import type { LeadFormData } from '@/types/lead.types';

export interface LeadValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateLeadForm(data: Partial<LeadFormData>): LeadValidationResult {
  const errors: Record<string, string> = {};

  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.fullName = 'Full name is required (minimum 2 characters)';
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email address format';
  }

  if (data.phone && !/^[\d\s\-+().]{7,20}$/.test(data.phone)) {
    errors.phone = 'Invalid phone number format';
  }

  if (data.estimatedValue !== undefined && data.estimatedValue < 0) {
    errors.estimatedValue = 'Estimated value cannot be negative';
  }

  const validStatuses = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.status = `Invalid status. Must be one of: ${validStatuses.join(', ')}`;
  }

  const validPriorities = ['low', 'medium', 'high'];
  if (data.priority && !validPriorities.includes(data.priority)) {
    errors.priority = `Invalid priority. Must be one of: ${validPriorities.join(', ')}`;
  }

  const validSources = ['manual', 'website', 'referral', 'ads', 'social', 'other'];
  if (data.source && !validSources.includes(data.source)) {
    errors.source = `Invalid source. Must be one of: ${validSources.join(', ')}`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  return /^[\d\s\-+().]{7,20}$/.test(phone);
}
