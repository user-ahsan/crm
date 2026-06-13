import type { LeadFormData } from '@/types/lead.types';
import type { ContactFormData } from '@/types/contact.types';
import type { CompanyFormData } from '@/types/company.types';
import type { TaskFormData } from '@/types/task.types';
import type { MeetingFormData } from '@/types/meeting.types';

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

export function validateContactForm(data: Partial<ContactFormData>): ValidationResult {
  const errors: Record<string, string> = {};
  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Name is required';
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email format';
  }
  if (data.phone && !PHONE_REGEX.test(data.phone)) {
    errors.phone = 'Invalid phone number format';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateCompanyForm(data: Partial<CompanyFormData>): ValidationResult {
  const errors: Record<string, string> = {};
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

export function validateTaskForm(data: Partial<TaskFormData>): ValidationResult {
  const errors: Record<string, string> = {};
  if (!data.title || data.title.trim().length === 0) {
    errors.title = 'Title is required';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateQuoteForm(data: { title: string; items: { description: string; quantity: number; unitPrice: number }[]; discount?: number }): ValidationResult {
  const errors: Record<string, string> = {};
  if (!data.title || data.title.trim().length === 0) {
    errors.title = 'Title is required';
  }
  if (!data.items || data.items.length === 0) {
    errors.items = 'At least one line item is required';
  }
  if (data.items) {
    for (let i = 0; i < data.items.length; i++) {
      if (!data.items[i].description.trim()) {
        errors[`items.${i}.description`] = 'Item description is required';
      }
      if (data.items[i].quantity <= 0) {
        errors[`items.${i}.quantity`] = 'Quantity must be greater than 0';
      }
      if (data.items[i].unitPrice < 0) {
        errors[`items.${i}.unitPrice`] = 'Unit price cannot be negative';
      }
    }
  }
  if (data.discount !== undefined && data.discount < 0) {
    errors.discount = 'Discount cannot be negative';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateMeetingForm(data: Partial<MeetingFormData>): ValidationResult {
  const errors: Record<string, string> = {};
  if (!data.title || data.title.trim().length === 0) {
    errors.title = 'Title is required';
  }
  if (!data.dateTime) {
    errors.dateTime = 'Date and time is required';
  }
  if (!data.duration || data.duration <= 0) {
    errors.duration = 'Duration must be greater than 0';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}
