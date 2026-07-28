import type { TeamFormData, InviteMemberFormData } from '@/types/team.types';
import type { ValidationErrors, ValidationResult } from '@/types/common.types';
import { EMAIL_REGEX } from '@/lib/utils';

/**
 * Validate team creation/edit form data.
 * - name is required and must be at least 2 characters
 * - description is optional
 */
export function validateTeamForm(data: Partial<TeamFormData>): ValidationResult {
  const errors: ValidationErrors = {};

  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Team name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Team name must be at least 2 characters';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate invitation form data.
 * - email is required and must be a valid format
 * - role is required and must be a valid TeamRole
 */
export function validateInviteForm(data: Partial<InviteMemberFormData>): ValidationResult {
  const errors: ValidationErrors = {};

  if (!data.email || data.email.trim().length === 0) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(data.email)) {
    errors.email = 'Enter a valid email address';
  }

  if (!data.role) {
    errors.role = 'Role is required';
  } else if (!['admin', 'manager', 'agent', 'viewer'].includes(data.role)) {
    errors.role = 'Invalid role selected';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}
