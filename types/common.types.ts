/**
 * Shared validation result type used across validators.
 * Returned by form/data validation functions to indicate
 * whether the input passed all checks and what errors exist.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}
