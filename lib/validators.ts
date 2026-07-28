import type { LeadFormData } from '@/types/lead.types';
import type { ContactFormData } from '@/types/contact.types';
import type { CompanyFormData } from '@/types/company.types';
import type { ValidationErrors, ValidationResult } from '@/types/common.types';
import { EMAIL_REGEX } from '@/lib/utils';

export const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/;

export function validateLeadForm(data: Partial<LeadFormData>): ValidationResult {
  const errors: ValidationErrors = {};
  if (!data.fullName || data.fullName.trim().length === 0) {
    errors.fullName = 'Full name is required';
  }
  if (data.email && !EMAIL_REGEX.test(data.email)) {
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

export function validateContactForm(data: Partial<ContactFormData>): ValidationResult {
  const errors: ValidationErrors = {};
  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Name is required';
  }
  if (data.email && !EMAIL_REGEX.test(data.email)) {
    errors.email = 'Invalid email format';
  }
  if (data.phone && !PHONE_REGEX.test(data.phone)) {
    errors.phone = 'Invalid phone number format';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateCompanyForm(data: Partial<CompanyFormData>): ValidationResult {
  const errors: ValidationErrors = {};
  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Company name is required';
  }
  if (data.revenue !== undefined && data.revenue < 0) {
    errors.revenue = 'Revenue cannot be negative';
  }
  if (data.website && !/^https?:\/\/.+/.test(data.website)) {
    errors.website = 'Website must start with http:// or https://';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}
