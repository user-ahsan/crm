import type { LeadStatus, LeadSource, LeadPriority } from '@/types/lead.types';
import type { TaskPriority, TaskStatus } from '@/types/task.types';
import type { MeetingType } from '@/types/meeting.types';
import type { CompanySize } from '@/types/company.types';
import type { ActivityType } from '@/types/activity.types';
import type { GoalType, GoalPeriod } from '@/types/goal.types';
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected'] as const;


export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
export const LEAD_SOURCES: LeadSource[] = ['manual', 'website', 'referral', 'ads', 'social'];
export const LEAD_PRIORITIES: LeadPriority[] = ['low', 'medium', 'high'];

export const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
export const TASK_STATUSES: TaskStatus[] = ['pending', 'completed', 'overdue'];

export const MEETING_TYPES: MeetingType[] = ['online', 'offline', 'call'];

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

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  contacted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  qualified: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  proposal: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export const PRIORITY_COLORS: Record<LeadPriority, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
};

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
      { label: 'Team', href: '/settings/team', icon: 'users-group' },
      { label: 'Workflows', href: '/settings/workflows', icon: 'hierarchy' },
      { label: 'Automation', href: '/settings/automation', icon: 'zap' },
      { label: 'Data Quality', href: '/settings/data-quality', icon: 'filter' },
      { label: 'Integrations', href: '/settings/integrations', icon: 'calendar-share' },
      { label: 'Portal', href: '/settings/portal', icon: 'world' },
      { label: 'API Keys', href: '/settings/api-keys', icon: 'api-key' },
      { label: 'Settings', href: '/settings', icon: 'settings' },
    ],
  },
];

// Flat list kept for backward compatibility
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items) as readonly { label: string; href: string; icon: string }[];

export const USERS = [
  { id: 'user-1', name: 'Alice Johnson', initials: 'AJ', color: 'bg-blue-500' },
  { id: 'user-2', name: 'Bob Smith', initials: 'BS', color: 'bg-green-500' },
  { id: 'user-3', name: 'Carol Williams', initials: 'CW', color: 'bg-purple-500' },
  { id: 'user-4', name: 'David Brown', initials: 'DB', color: 'bg-orange-500' },
  { id: 'user-5', name: 'Eva Martinez', initials: 'EM', color: 'bg-pink-500' },
];
