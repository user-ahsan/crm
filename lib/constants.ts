/**
 * ─── Theme Hydration Script ───────────────────────────────────────────
 * SAFE: Static string literal — no user input, no dynamic interpolation.
 *
 * This script prevents FOUC (flash of unstyled content) by reading the
 * persisted theme from localStorage *synchronously* during HTML parsing,
 * before React hydrates. It's injected via dangerouslySetInnerHTML because
 * Next.js escapes JSX children in <script> tags, and this must run inline
 * in <head> to avoid the flash.
 *
 * The content is a compile-time constant: no variables, no templates, no
 * user-supplied values. As long as the string itself stays static, this
 * pattern is safe and is the standard approach in Next.js for inline
 * theme scripts.
 */
export const THEME_HYDRATION_SCRIPT = `(function(){try{var e=JSON.parse(localStorage.getItem('nexuscrm-theme'));if(e&&e.state&&'dark'===e.state.theme)document.documentElement.classList.add('dark')}catch(e){}})()`;

import type { LeadStatus, LeadSource, LeadPriority } from '@/types/lead.types';
import type { TaskPriority, TaskStatus } from '@/types/task.types';
import type { MeetingType } from '@/types/meeting.types';
import type { CompanySize } from '@/types/company.types';
import type { ActivityType } from '@/types/activity.types';
import type { GoalType, GoalPeriod } from '@/types/goal.types';
import type { ScoringFactor } from '@/types/lead-scoring.types';

export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
export const LEAD_SOURCES: LeadSource[] = ['manual', 'website', 'referral', 'ads', 'social'];
export const LEAD_PRIORITIES: LeadPriority[] = ['low', 'medium', 'high'];

export const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
export const TASK_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'overdue'];

export const MEETING_TYPES: MeetingType[] = ['online', 'offline', 'call', 'video', 'in_person', 'other'];

export const COMPANY_SIZES: CompanySize[] = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

export const GOAL_TYPES: GoalType[] = ['revenue', 'deals_count', 'leads_created', 'tasks_completed', 'calls_made', 'custom'];
export const GOAL_PERIODS: GoalPeriod[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  revenue: 'Revenue',
  deals_count: 'Deals Count',
  leads_created: 'Leads Created',
  tasks_completed: 'Tasks Completed',
  calls_made: 'Calls Made',
  custom: 'Custom',
};

export const GOAL_TYPE_ICONS: Record<GoalType, string> = {
  revenue: 'currency-dollar',
  deals_count: 'columns-3',
  leads_created: 'users',
  tasks_completed: 'checkbox',
  calls_made: 'phone',
  custom: 'flag',
};

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

// ── Pagination constants ─────────────────────────────────────────────
export const PAGE_SIZE = 50;

// ── Lead scoring thresholds ──────────────────────────────────────────
export const LEAD_SCORE_EMAIL_PRESENT = 20;
export const LEAD_SCORE_PHONE_PRESENT = 15;
export const LEAD_SCORE_COMPANY_PRESENT = 10;
export const LEAD_SCORE_SOURCE_QUALITY = 15;
export const LEAD_SCORE_TAG_BONUS = 5;
export const LEAD_SCORE_LOST_PENALTY = -10;

// ── Company duplicate detection weights ──────────────────────────────
export const DUPE_WEIGHT_NAME_EXACT = 40;
export const DUPE_WEIGHT_NAME_PARTIAL = 20;
export const DUPE_WEIGHT_WEBSITE = 35;
export const DUPE_WEIGHT_INDUSTRY = 10;
export const DUPE_MIN_SCORE = 20;

// ── Rate limiting ────────────────────────────────────────────────────
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_ATTEMPTS = 10;

export const SCORING_FACTORS: ScoringFactor[] = [
  { key: 'email_present', label: 'Email present', weight: 20, description: '+20 if email exists' },
  { key: 'phone_present', label: 'Phone present', weight: 15, description: '+15 if phone exists' },
  { key: 'company_present', label: 'Company present', weight: 10, description: '+10 if company exists' },
  { key: 'source_quality', label: 'Source quality', weight: 15, description: '+15 if referral or website' },
  { key: 'tags_count', label: 'Tags', weight: 5, description: '+5 per tag' },
  { key: 'lost_penalty', label: 'Lost penalty', weight: -10, description: '-10 if status is lost' },
];

export const ACTIVITY_TYPES: ActivityType[] = [
  'created',
  'updated',
  'deleted',
  'status_changed',
  'note_added',
  'meeting_scheduled',
  'meeting_completed',
  'task_created',
  'task_completed',
  'communication_logged',
  'assigned',
];

/**
 * @deprecated Import from '@/lib/color-tokens' instead.
 * The new tokens use CSS custom properties for automatic dark mode
 * and centralized theming. Remove this once all imports are migrated.
 */
export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  contacted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  qualified: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  proposal: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

/**
 * @deprecated Import from '@/lib/color-tokens' instead.
 */
export const PRIORITY_COLORS: Record<LeadPriority, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
};

/**
 * @deprecated Import from '@/lib/color-tokens' instead.
 */
export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
};

export const PIPELINE_STAGES: { key: LeadStatus; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: 'border-t-blue-500' },
  { key: 'contacted', label: 'Contacted', color: 'border-t-yellow-500' },
  { key: 'qualified', label: 'Qualified', color: 'border-t-purple-500' },
  { key: 'proposal', label: 'Proposal', color: 'border-t-orange-500' },
  { key: 'won', label: 'Won', color: 'border-t-green-500' },
  { key: 'lost', label: 'Lost', color: 'border-t-red-500' },
];

export interface NavGroup {
  label: string;
  items: readonly { label: string; href: string; icon: string }[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'layout-dashboard' },
      { label: 'Leads', href: '/leads', icon: 'users' },
      { label: 'Contacts', href: '/contacts', icon: 'address-book' },
      { label: 'Pipeline', href: '/pipeline', icon: 'columns-3' },
      { label: 'Tasks', href: '/tasks', icon: 'checkbox' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Deals', href: '/deals', icon: 'currency-dollar' },
      { label: 'Companies', href: '/companies', icon: 'building' },
      { label: 'Meetings', href: '/meetings', icon: 'calendar' },
      { label: 'Campaigns', href: '/campaigns', icon: 'mail-forward' },
      { label: 'Quotes', href: '/quotes', icon: 'file-invoice' },
      { label: 'Invoices', href: '/invoices', icon: 'receipt' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', href: '/analytics', icon: 'chart-bar' },
      { label: 'Goals', href: '/goals', icon: 'flag' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Settings', href: '/settings', icon: 'settings' },
    ],
  },
];

// Flat list kept for backward compatibility
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items) as readonly { label: string; href: string; icon: string }[];

// USERS moved to data/mock-users.ts — import from '@/data/mock-users'
