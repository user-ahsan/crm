/**
 * Shared validation result type used across validators.
 * Returned by form/data validation functions to indicate
 * whether the input passed all checks and what errors exist.
 */
export type ValidationErrors = Record<string, string>;

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
}
