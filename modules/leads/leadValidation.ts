import type { LeadFormData } from '@/types/lead.types';

export const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/;

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateLeadForm(data: Partial<LeadFormData>): ValidationResult {
  const errors: Record<string, string> = {};
  if (!data.fullName || data.fullName.trim().length === 0) {
    errors.fullName = 'Full name is required';
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email format';
  }
  if (data.phone && !PHONE_REGEX.test(data.phone)) {
    errors.phone = 'Invalid phone number format';
  }
  if (data.estimatedValue !== undefined && data.estimatedValue < 0) {
    errors.estimatedValue = 'Estimated value cannot be negative';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}
