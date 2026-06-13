/**
 * Lead validation module.
 *
 * Re-exports validateLeadForm from @/lib/validators for consistency with
 * the modular architecture — each feature module has a validation entry
 * point so that consumers always import from the module, not from lib/.
 */
import { validateLeadForm } from '@/lib/validators';
export { validateLeadForm } from '@/lib/validators';
