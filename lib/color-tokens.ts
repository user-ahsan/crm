/**
 * ─── Color Tokens ──────────────────────────────────────────────────────────
 *
 * Semantic color classes for statuses and priorities, backed by CSS custom
 * properties defined in `app/globals.css` via Tailwind v4's `@theme inline`.
 *
 * Light / dark switching is handled automatically by CSS variable overrides
 * in the `.dark` block — no `dark:` prefix needed in class strings.
 *
 * To rebrand, edit the CSS variable values in `globals.css` in one place.
 * These tokens are the sole source of truth for UI badge/indicator colors.
 */

import type { LeadStatus, LeadPriority } from '@/types/lead.types';
import type { TaskPriority } from '@/types/task.types';

/**
 * Status badge colors — CSS-variable-based, auto-dark-mode.
 */
export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-status-new-bg text-status-new-text',
  contacted: 'bg-status-contacted-bg text-status-contacted-text',
  qualified: 'bg-status-qualified-bg text-status-qualified-text',
  proposal: 'bg-status-proposal-bg text-status-proposal-text',
  won: 'bg-status-won-bg text-status-won-text',
  lost: 'bg-status-lost-bg text-status-lost-text',
};

/**
 * Lead priority badge colors — CSS-variable-based, auto-dark-mode.
 */
export const PRIORITY_COLORS: Record<LeadPriority, string> = {
  low: 'bg-priority-low-bg text-priority-low-text',
  medium: 'bg-priority-medium-bg text-priority-medium-text',
  high: 'bg-priority-high-bg text-priority-high-text',
};

/**
 * Task priority badge colors — CSS-variable-based, auto-dark-mode.
 * "high" uses orange (not red) to distinguish from lead-priority "high".
 */
export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-task-priority-low-bg text-task-priority-low-text',
  medium: 'bg-task-priority-medium-bg text-task-priority-medium-text',
  high: 'bg-task-priority-high-bg text-task-priority-high-text',
  critical: 'bg-task-priority-critical-bg text-task-priority-critical-text',
};
